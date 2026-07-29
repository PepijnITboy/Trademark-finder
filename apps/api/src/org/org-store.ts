import { DEMO_BETA_IDS, DEMO_SECONDARY_ORG_ID, DEV_SEED_IDS } from '@merkwacht/database';
import {
  DEFAULT_PLAN_CATALOG,
  ENTITLEMENT_MESSAGES_NL,
  PLAN_CHANGE_MESSAGES_NL,
  ROLE_GUARD_MESSAGES_NL,
  assertRoleMutationAllowed,
  buildInvoiceLineItems,
  canAddNotificationRecipient,
  canAddWatchedTrademark,
  computeNlBtw,
  deriveNlBtwFromIncVat,
  evaluatePlanChange,
  isAdminRole,
  normalizeRecipientNotifyConfig,
  resolveEntitlements,
  sumInvoiceLineItems,
  type DigestCadence,
  type FeatureFlag,
  type NotifyMode,
  type PlanLimits,
  type SubscriptionEntitlements,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type WorkspaceRole,
} from '@merkwacht/domain';
import { AppError, createId } from '@merkwacht/shared';
import type {
  BillingEventProvider,
  BillingEventRecord,
  InAppNotificationRecord,
  InvoiceLineItemRecord,
  InvoiceRecord,
  NotificationRecipientRecord,
  OrganizationListItem,
  OrganizationMemberRecord,
  OrganizationMemberRole,
  OrganizationProfileRecord,
  ParsedAddressResult,
  PlanCatalogRecord,
  SubscriptionStateRecord,
  SupportMessageRecord,
  SupportParticipantRecord,
  SupportThreadRecord,
} from './types.js';

export { DEMO_SECONDARY_ORG_ID };

function nowIso(): string {
  return new Date().toISOString();
}

function clonePlanCatalog(): Map<SubscriptionPlan, PlanCatalogRecord> {
  const catalog = new Map<SubscriptionPlan, PlanCatalogRecord>();
  const now = nowIso();
  for (const [code, limits] of Object.entries(DEFAULT_PLAN_CATALOG) as [SubscriptionPlan, PlanLimits][]) {
    catalog.set(code, {
      code,
      displayNameNl: limits.displayNameNl,
      priceMonthlyCents: limits.priceMonthlyCents,
      maxWatchedTrademarks: limits.maxWatchedTrademarks,
      maxNotificationEmails: limits.maxNotificationEmails,
      supportTier: limits.supportTier,
      features: { ...limits.features },
      isActive: true,
      updatedAt: now,
    });
  }
  return catalog;
}

function planRecordToLimits(record: PlanCatalogRecord): PlanLimits {
  return {
    displayNameNl: record.displayNameNl,
    priceMonthlyCents: record.priceMonthlyCents,
    maxWatchedTrademarks: record.maxWatchedTrademarks,
    maxNotificationEmails: record.maxNotificationEmails,
    supportTier: record.supportTier,
    features: record.features,
  };
}

interface OrgData {
  profile: OrganizationProfileRecord;
  members: Map<string, OrganizationMemberRecord>;
  recipients: Map<string, NotificationRecipientRecord>;
  subscription: SubscriptionStateRecord;
  invoices: Map<string, InvoiceRecord>;
  billingEvents: BillingEventRecord[];
  threads: Map<string, SupportThreadRecord>;
  participants: Map<string, SupportParticipantRecord>;
  messages: Map<string, SupportMessageRecord[]>;
}

function roleGuardError(reason: keyof typeof ROLE_GUARD_MESSAGES_NL): never {
  throw new AppError({
    code: 'ROLE_MUTATION_DENIED',
    messageNl: ROLE_GUARD_MESSAGES_NL[reason],
    category: 'AUTHORIZATION',
  });
}

function entitlementError(reason: keyof typeof ENTITLEMENT_MESSAGES_NL): never {
  const httpStatus =
    reason === 'watched_trademark_limit' || reason === 'notification_email_limit' ? 402 : undefined;
  throw new AppError({
    code: 'ENTITLEMENT_DENIED',
    messageNl: ENTITLEMENT_MESSAGES_NL[reason],
    category: 'AUTHORIZATION',
    ...(httpStatus !== undefined ? { httpStatus } : {}),
  });
}

function planChangeError(reason: keyof typeof PLAN_CHANGE_MESSAGES_NL): never {
  throw new AppError({
    code: 'PLAN_CHANGE_DENIED',
    messageNl: PLAN_CHANGE_MESSAGES_NL[reason],
    category: 'CONFLICT',
  });
}

/**
 * In-memory org profile, billing, notification recipients, and support chat.
 * Mirrors the DemoStore approach: no external dependency, state resets on restart.
 */
export class OrgBillingChatStore {
  private readonly orgs = new Map<string, OrgData>();
  private readonly planCatalog = clonePlanCatalog();
  private readonly inAppNotifications: InAppNotificationRecord[] = [];
  private invoiceSeq = 43;

  constructor(primaryOrganizationId: string, settingsEmail = 'merkbewaking@voorbeeld-merkenbureau.nl') {
    this.seedOrg({
      organizationId: primaryOrganizationId,
      settingsEmail,
      legalName: 'Lumaro B.V.',
      plan: 'starter',
      status: 'active',
      ownerUserId: DEV_SEED_IDS.userId,
      kvkNumber: '12345678',
      invoicePrefix: '004',
    });
    this.seedOrg({
      organizationId: DEMO_SECONDARY_ORG_ID,
      settingsEmail: 'info@fictieve-retail.nl',
      legalName: 'Fictieve Retail Groep B.V.',
      plan: 'pro',
      status: 'trialing',
      ownerUserId: DEMO_BETA_IDS.userId,
      kvkNumber: '87654321',
      invoicePrefix: '005',
      addressLine: 'Coolsingel 10',
      postalCode: '3011 AD',
      city: 'Rotterdam',
    });
  }

  private seedOrg(input: {
    organizationId: string;
    settingsEmail: string;
    legalName: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    ownerUserId: string;
    kvkNumber: string;
    invoicePrefix: string;
    addressLine?: string;
    postalCode?: string;
    city?: string;
  }): void {
    const now = nowIso();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const juristId = createId();

    const members = new Map<string, OrganizationMemberRecord>([
      [
        input.ownerUserId,
        {
          id: input.ownerUserId,
          organizationId: input.organizationId,
          email: input.settingsEmail.replace(/^[^@]+/, 'admin'),
          displayName: input.organizationId === DEMO_SECONDARY_ORG_ID ? 'Retail Admin' : 'Demo Admin',
          role: 'owner',
          jobTitle: 'Hoofd merkenrecht',
          phone: '+31 20 123 4567',
          createdAt: now,
          updatedAt: now,
        },
      ],
      [
        juristId,
        {
          id: juristId,
          organizationId: input.organizationId,
          email: input.settingsEmail.replace(/^[^@]+/, 'jurist'),
          displayName: input.organizationId === DEMO_SECONDARY_ORG_ID ? 'Retail Jurist' : 'Demo Jurist',
          role: 'jurist',
          jobTitle: 'Jurist merkenrecht',
          phone: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    ]);

    const recipientId = createId();
    const recipients = new Map<string, NotificationRecipientRecord>([
      [
        recipientId,
        {
          id: recipientId,
          organizationId: input.organizationId,
          email: input.settingsEmail,
          mode: 'digest',
          digestCadence: 'DAILY',
          digestFrequency: 'DAILY',
          minScoreThreshold: null,
          isActive: true,
          watchedTrademarkIds: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    ]);

    const openInvoiceId = createId();
    const paidInvoiceId = createId();
    const openEx = input.plan === 'pro' ? 14900 : 4900;
    const openBtw = computeNlBtw(openEx);
    const invoices = new Map<string, InvoiceRecord>([
      [
        openInvoiceId,
        {
          id: openInvoiceId,
          organizationId: input.organizationId,
          number: `INV-2026-${input.invoicePrefix}2`,
          status: 'open',
          amountCents: openBtw.incVatCents,
          exVatCents: openBtw.exVatCents,
          btwCents: openBtw.btwCents,
          currency: 'EUR',
          description: `Merkwacht ${input.plan === 'pro' ? 'Pro' : 'Starter'} — maandelijks abonnement`,
          lineItems: buildInvoiceLineItems([
            { description: `Abonnement ${input.plan}`, exVatCents: openEx },
          ]),
          paidAt: null,
          dueAt: periodEnd,
          internalNote: null,
          pdfAvailable: true,
          ublXmlAvailable: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      [
        paidInvoiceId,
        {
          id: paidInvoiceId,
          organizationId: input.organizationId,
          number: `INV-2026-${input.invoicePrefix}1`,
          status: 'paid',
          amountCents: openBtw.incVatCents,
          exVatCents: openBtw.exVatCents,
          btwCents: openBtw.btwCents,
          currency: 'EUR',
          description: `Merkwacht ${input.plan === 'pro' ? 'Pro' : 'Starter'} — maandelijks abonnement`,
          lineItems: buildInvoiceLineItems([
            { description: `Abonnement ${input.plan}`, exVatCents: openEx },
          ]),
          paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          dueAt: null,
          internalNote: null,
          pdfAvailable: true,
          ublXmlAvailable: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    ]);

    this.orgs.set(input.organizationId, {
      profile: {
        organizationId: input.organizationId,
        legalName: input.legalName,
        addressLine: input.addressLine ?? 'Herengracht 124',
        postalCode: input.postalCode ?? '1015 BT',
        city: input.city ?? 'Amsterdam',
        country: 'NL',
        kvkNumber: input.kvkNumber,
        contactEmail: input.settingsEmail,
        billingEmail: input.settingsEmail,
        phone: '+31 20 123 4567',
        latitude: 52.377956,
        longitude: 4.89707,
        updatedAt: now,
      },
      members,
      recipients,
      subscription: {
        organizationId: input.organizationId,
        plan: input.plan,
        status: input.status,
        pendingPlan: null,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        nextInvoiceAt: periodEnd,
        updatedAt: now,
      },
      invoices,
      billingEvents: [],
      threads: new Map(),
      participants: new Map(),
      messages: new Map(),
    });
  }

  private getOrg(organizationId: string): OrgData {
    const org = this.orgs.get(organizationId);
    if (!org) {
      throw new AppError({
        code: 'ORGANIZATION_NOT_FOUND',
        messageNl: 'De opgevraagde organisatie bestaat niet.',
        category: 'NOT_FOUND',
      });
    }
    return org;
  }

  private countAdmins(org: OrgData): number {
    return [...org.members.values()].filter((member) => isAdminRole(member.role)).length;
  }

  private assertRoleAllowed(input: {
    actorRole: WorkspaceRole;
    targetRole: WorkspaceRole;
    nextRole?: WorkspaceRole;
    adminCount: number;
    isSelf: boolean;
  }): void {
    if (input.actorRole === 'jurist' && isAdminRole(input.targetRole)) {
      roleGuardError('jurist_cannot_manage_admins');
    }
    const denial = assertRoleMutationAllowed(input);
    if (denial) roleGuardError(denial);
  }

  getEntitlements(organizationId: string): SubscriptionEntitlements {
    const org = this.getOrg(organizationId);
    const limits = planRecordToLimits(this.planCatalog.get(org.subscription.plan)!);
    return resolveEntitlements({
      organizationId,
      plan: org.subscription.plan,
      status: org.subscription.status,
      limits,
      pendingPlan: org.subscription.pendingPlan,
      currentPeriodEnd: org.subscription.currentPeriodEnd,
    });
  }

  getProfile(organizationId: string): OrganizationProfileRecord {
    return this.getOrg(organizationId).profile;
  }

  updateProfile(
    organizationId: string,
    patch: Partial<Omit<OrganizationProfileRecord, 'organizationId' | 'updatedAt'>>,
  ): OrganizationProfileRecord {
    const org = this.getOrg(organizationId);
    org.profile = { ...org.profile, ...patch, updatedAt: nowIso() };
    return org.profile;
  }

  parseAddress(addressLine: string): ParsedAddressResult {
    const trimmed = addressLine.trim();
    let postalCode = '';
    let city = '';
    let street = trimmed;

    const nlMatch = trimmed.match(/^(.+?),\s*(\d{4}\s?[A-Z]{2})\s+(.+)$/i);
    if (nlMatch) {
      street = nlMatch[1]!.trim();
      postalCode = nlMatch[2]!.replace(/\s/g, ' ').toUpperCase();
      city = nlMatch[3]!.trim();
    } else {
      const inlineMatch = trimmed.match(/^(.+?)\s+(\d{4}\s?[A-Z]{2})\s+(.+)$/i);
      if (inlineMatch) {
        street = inlineMatch[1]!.trim();
        postalCode = inlineMatch[2]!.replace(/\s/g, ' ').toUpperCase();
        city = inlineMatch[3]!.trim();
      }
    }

    const hash = trimmed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const latitude = 52.3 + (hash % 100) / 1000;
    const longitude = 4.8 + (hash % 200) / 1000;

    return {
      addressLine: street,
      postalCode,
      city,
      country: 'NL',
      latitude: Math.round(latitude * 1_000_000) / 1_000_000,
      longitude: Math.round(longitude * 1_000_000) / 1_000_000,
    };
  }

  listMembers(organizationId: string): readonly OrganizationMemberRecord[] {
    return [...this.getOrg(organizationId).members.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  createMember(
    organizationId: string,
    input: {
      email: string;
      displayName: string;
      role: OrganizationMemberRole;
      jobTitle?: string | null;
      phone?: string | null;
    },
    actorRole: WorkspaceRole,
  ): OrganizationMemberRecord {
    this.assertRoleAllowed({
      actorRole,
      targetRole: 'jurist',
      nextRole: input.role === 'owner' ? 'owner' : input.role,
      adminCount: this.countAdmins(this.getOrg(organizationId)),
      isSelf: false,
    });

    const now = nowIso();
    const member: OrganizationMemberRecord = {
      id: createId(),
      organizationId,
      email: input.email,
      displayName: input.displayName,
      role: input.role === 'owner' ? 'admin' : input.role,
      jobTitle: input.jobTitle ?? null,
      phone: input.phone ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.getOrg(organizationId).members.set(member.id, member);
    return member;
  }

  updateMember(
    organizationId: string,
    memberId: string,
    patch: {
      displayName?: string;
      role?: OrganizationMemberRole;
      jobTitle?: string | null;
      phone?: string | null;
    },
    actorRole: WorkspaceRole,
    actorUserId: string,
  ): OrganizationMemberRecord | null {
    const org = this.getOrg(organizationId);
    const existing = org.members.get(memberId);
    if (!existing) return null;

    if (patch.role !== undefined) {
      this.assertRoleAllowed({
        actorRole,
        targetRole: existing.role,
        nextRole: patch.role,
        adminCount: this.countAdmins(org),
        isSelf: memberId === actorUserId,
      });
    }

    const updated: OrganizationMemberRecord = {
      ...existing,
      displayName: patch.displayName ?? existing.displayName,
      role: patch.role ?? existing.role,
      jobTitle: patch.jobTitle !== undefined ? patch.jobTitle : existing.jobTitle,
      phone: patch.phone !== undefined ? patch.phone : existing.phone,
      updatedAt: nowIso(),
    };
    org.members.set(memberId, updated);
    return updated;
  }

  removeMember(organizationId: string, memberId: string, actorRole: WorkspaceRole, actorUserId: string): boolean {
    const org = this.getOrg(organizationId);
    const existing = org.members.get(memberId);
    if (!existing) return false;

    this.assertRoleAllowed({
      actorRole,
      targetRole: existing.role,
      adminCount: this.countAdmins(org),
      isSelf: memberId === actorUserId,
    });

    return org.members.delete(memberId);
  }

  listRecipients(organizationId: string): readonly NotificationRecipientRecord[] {
    return [...this.getOrg(organizationId).recipients.values()].sort((a, b) => a.email.localeCompare(b.email));
  }

  createRecipient(
    organizationId: string,
    input: {
      email: string;
      mode: NotifyMode;
      digestCadence?: DigestCadence | null;
      minScoreThreshold?: number | null;
      allWatches?: boolean;
      watchedTrademarkIds?: string[];
    },
    activeWatchedTrademarkIds: readonly string[],
  ): NotificationRecipientRecord {
    const org = this.getOrg(organizationId);
    const entitlements = this.getEntitlements(organizationId);
    const denial = canAddNotificationRecipient(entitlements, org.recipients.size);
    if (denial) entitlementError(denial);

    const normalized = normalizeRecipientNotifyConfig({
      mode: input.mode,
      digestCadence: input.digestCadence,
      minScoreThreshold: input.minScoreThreshold,
    });
    if (!normalized.ok) {
      throw new AppError({
        code: 'INVALID_RECIPIENT_CONFIG',
        messageNl: normalized.message,
        category: 'VALIDATION',
      });
    }

    const useAllWatches = input.allWatches !== false && (!input.watchedTrademarkIds || input.watchedTrademarkIds.length === 0);
    const watchedTrademarkIds = useAllWatches ? [...activeWatchedTrademarkIds] : [...(input.watchedTrademarkIds ?? [])];

    const now = nowIso();
    const record: NotificationRecipientRecord = {
      id: createId(),
      organizationId,
      email: input.email,
      mode: normalized.config.mode,
      digestCadence: normalized.config.digestCadence,
      digestFrequency: normalized.config.digestCadence ?? 'DAILY',
      minScoreThreshold: normalized.config.minScoreThreshold,
      isActive: true,
      watchedTrademarkIds,
      createdAt: now,
      updatedAt: now,
    };
    org.recipients.set(record.id, record);
    return record;
  }

  updateRecipient(
    organizationId: string,
    recipientId: string,
    patch: {
      mode?: NotifyMode;
      digestCadence?: DigestCadence | null;
      minScoreThreshold?: number | null;
      isActive?: boolean;
      allWatches?: boolean;
      watchedTrademarkIds?: string[];
    },
    activeWatchedTrademarkIds: readonly string[],
  ): NotificationRecipientRecord | null {
    const org = this.getOrg(organizationId);
    const existing = org.recipients.get(recipientId);
    if (!existing) return null;

    let watchedTrademarkIds = existing.watchedTrademarkIds;
    if (patch.allWatches === true) {
      watchedTrademarkIds = [...activeWatchedTrademarkIds];
    }
    if (patch.watchedTrademarkIds !== undefined) {
      watchedTrademarkIds = [...patch.watchedTrademarkIds];
    }

    const nextMode = patch.mode ?? existing.mode;
    const normalized = normalizeRecipientNotifyConfig({
      mode: nextMode,
      digestCadence:
        patch.digestCadence !== undefined ? patch.digestCadence : existing.digestCadence,
      minScoreThreshold:
        patch.minScoreThreshold !== undefined
          ? patch.minScoreThreshold
          : existing.minScoreThreshold,
    });
    if (!normalized.ok) {
      throw new AppError({
        code: 'INVALID_RECIPIENT_CONFIG',
        messageNl: normalized.message,
        category: 'VALIDATION',
      });
    }

    const updated: NotificationRecipientRecord = {
      ...existing,
      mode: normalized.config.mode,
      digestCadence: normalized.config.digestCadence,
      digestFrequency: normalized.config.digestCadence ?? existing.digestFrequency,
      minScoreThreshold: normalized.config.minScoreThreshold,
      isActive: patch.isActive ?? existing.isActive,
      watchedTrademarkIds,
      updatedAt: nowIso(),
    };
    org.recipients.set(recipientId, updated);
    return updated;
  }

  deleteRecipient(organizationId: string, recipientId: string): boolean {
    return this.getOrg(organizationId).recipients.delete(recipientId);
  }

  getSubscription(organizationId: string): SubscriptionStateRecord {
    return this.getOrg(organizationId).subscription;
  }

  listPlans(): readonly PlanCatalogRecord[] {
    return [...this.planCatalog.values()].sort((a, b) => a.priceMonthlyCents - b.priceMonthlyCents);
  }

  listActivePlans(): readonly PlanCatalogRecord[] {
    return this.listPlans().filter((plan) => plan.isActive);
  }

  listOrganizations(watchedCounts?: ReadonlyMap<string, number>): readonly OrganizationListItem[] {
    return [...this.orgs.values()]
      .map((org) => ({
        id: org.profile.organizationId,
        legalName: org.profile.legalName,
        plan: org.subscription.plan,
        status: org.subscription.status,
        since: [...org.members.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.createdAt
          ?? org.subscription.updatedAt,
        openInvoiceCount: [...org.invoices.values()].filter((invoice) => invoice.status === 'open').length,
        memberCount: org.members.size,
        watchedTrademarkCount: watchedCounts?.get(org.profile.organizationId) ?? 0,
      }))
      .sort((a, b) => a.legalName.localeCompare(b.legalName, 'nl'));
  }

  hasOrganization(organizationId: string): boolean {
    return this.orgs.has(organizationId);
  }

  changePlan(
    organizationId: string,
    targetPlan: SubscriptionPlan,
    counts: { activeWatchedCount: number; recipientCount: number },
  ): SubscriptionStateRecord {
    const org = this.getOrg(organizationId);
    const current = this.getEntitlements(organizationId);
    const targetRecord = this.planCatalog.get(targetPlan);
    if (!targetRecord || !targetRecord.isActive) {
      throw new AppError({
        code: 'PLAN_NOT_FOUND',
        messageNl: 'Het gekozen abonnement bestaat niet of is uitgeschakeld.',
        category: 'NOT_FOUND',
      });
    }

    const evaluation = evaluatePlanChange({
      current,
      targetPlan,
      targetLimits: planRecordToLimits(targetRecord),
      activeWatchedCount: counts.activeWatchedCount,
      recipientCount: counts.recipientCount,
    });

    if (!evaluation.ok) planChangeError(evaluation.reason);

    const now = nowIso();
    if (evaluation.immediate) {
      org.subscription = {
        ...org.subscription,
        plan: targetPlan,
        status: 'active',
        pendingPlan: null,
        updatedAt: now,
      };
    } else {
      org.subscription = {
        ...org.subscription,
        status: 'pending_downgrade',
        pendingPlan: targetPlan,
        updatedAt: now,
      };
    }
    return org.subscription;
  }

  updatePlanCatalog(
    plan: SubscriptionPlan,
    patch: Partial<Omit<PlanCatalogRecord, 'code' | 'updatedAt' | 'features'>> & {
      features?: Partial<Record<FeatureFlag, boolean>>;
    },
  ): PlanCatalogRecord | null {
    const existing = this.planCatalog.get(plan);
    if (!existing) return null;

    const updated: PlanCatalogRecord = {
      ...existing,
      displayNameNl: patch.displayNameNl ?? existing.displayNameNl,
      priceMonthlyCents: patch.priceMonthlyCents ?? existing.priceMonthlyCents,
      maxWatchedTrademarks: patch.maxWatchedTrademarks ?? existing.maxWatchedTrademarks,
      maxNotificationEmails: patch.maxNotificationEmails ?? existing.maxNotificationEmails,
      supportTier: patch.supportTier ?? existing.supportTier,
      features: patch.features ? { ...existing.features, ...patch.features } : existing.features,
      isActive: patch.isActive ?? existing.isActive,
      updatedAt: nowIso(),
    };
    this.planCatalog.set(plan, updated);
    return updated;
  }

  forceSubscription(
    organizationId: string,
    patch: { plan?: SubscriptionPlan; status?: SubscriptionStatus; pendingPlan?: SubscriptionPlan | null },
  ): SubscriptionStateRecord {
    const org = this.getOrg(organizationId);
    org.subscription = {
      ...org.subscription,
      plan: patch.plan ?? org.subscription.plan,
      status: patch.status ?? org.subscription.status,
      pendingPlan: patch.pendingPlan !== undefined ? patch.pendingPlan : org.subscription.pendingPlan,
      updatedAt: nowIso(),
    };
    return org.subscription;
  }

  listInvoices(organizationId: string): readonly InvoiceRecord[] {
    return [...this.getOrg(organizationId).invoices.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Customer-safe invoice view without internal platform notes. */
  listCustomerInvoices(organizationId: string): readonly Omit<InvoiceRecord, 'internalNote'>[] {
    return this.listInvoices(organizationId).map(({ internalNote: _note, ...rest }) => rest);
  }

  getInvoice(organizationId: string, invoiceId: string): InvoiceRecord | null {
    return this.getOrg(organizationId).invoices.get(invoiceId) ?? null;
  }

  createInvoice(
    organizationId: string,
    input: {
      amountCents?: number;
      exVatCents?: number;
      lineItems?: readonly { description: string; exVatCents: number }[];
      description: string;
      status?: 'draft' | 'open' | 'paid';
      number?: string;
      dueAt?: string | null;
    },
  ): InvoiceRecord {
    const org = this.getOrg(organizationId);
    const now = nowIso();
    const seq = this.invoiceSeq++;

    let lineItems: readonly InvoiceLineItemRecord[] | undefined;
    let totals: { exVatCents: number; btwCents: number; incVatCents: number };
    if (input.lineItems && input.lineItems.length > 0) {
      lineItems = buildInvoiceLineItems(input.lineItems);
      totals = sumInvoiceLineItems(lineItems);
    } else if (input.exVatCents !== undefined) {
      lineItems = buildInvoiceLineItems([{ description: input.description, exVatCents: input.exVatCents }]);
      totals = computeNlBtw(input.exVatCents);
    } else {
      totals = deriveNlBtwFromIncVat(input.amountCents ?? 0);
      lineItems = buildInvoiceLineItems([{ description: input.description, exVatCents: totals.exVatCents }]);
    }

    const status = input.status ?? 'open';
    const invoice: InvoiceRecord = {
      id: createId(),
      organizationId,
      number: input.number ?? `INV-2026-${String(seq).padStart(4, '0')}`,
      status,
      amountCents: totals.incVatCents,
      exVatCents: totals.exVatCents,
      btwCents: totals.btwCents,
      currency: 'EUR',
      description: input.description,
      lineItems,
      paidAt: status === 'paid' ? now : null,
      dueAt: input.dueAt ?? (status === 'draft' ? null : org.subscription.currentPeriodEnd),
      internalNote: null,
      pdfAvailable: status !== 'draft',
      ublXmlAvailable: status !== 'draft',
      createdAt: now,
      updatedAt: now,
    };
    org.invoices.set(invoice.id, invoice);
    return invoice;
  }

  requestCancelAtPeriodEnd(organizationId: string): SubscriptionStateRecord {
    const org = this.getOrg(organizationId);
    org.subscription = {
      ...org.subscription,
      cancelAtPeriodEnd: true,
      nextInvoiceAt: null,
      updatedAt: nowIso(),
    };
    return org.subscription;
  }

  undoCancelAtPeriodEnd(organizationId: string): SubscriptionStateRecord {
    const org = this.getOrg(organizationId);
    org.subscription = {
      ...org.subscription,
      cancelAtPeriodEnd: false,
      nextInvoiceAt: org.subscription.currentPeriodEnd,
      updatedAt: nowIso(),
    };
    return org.subscription;
  }

  /**
   * Issues (draft → open) the subscription's next invoice from the current
   * plan price. When `cancelAtPeriodEnd` was requested, this is the point
   * where cancellation actually takes effect instead of rolling the period
   * forward — mirroring how Stripe finalizes the last invoice before churn.
   */
  issueUpcomingInvoice(organizationId: string): InvoiceRecord {
    const org = this.getOrg(organizationId);
    const plan = this.planCatalog.get(org.subscription.plan)!;
    const description = `Merkwacht ${plan.displayNameNl} — maandelijks abonnement`;
    const draft = this.createInvoice(organizationId, {
      description,
      lineItems: [{ description, exVatCents: plan.priceMonthlyCents }],
      status: 'draft',
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const finalized = this.finalizeInvoice(organizationId, draft.id)!;

    if (org.subscription.cancelAtPeriodEnd) {
      org.subscription = {
        ...org.subscription,
        status: 'canceled',
        cancelAtPeriodEnd: false,
        nextInvoiceAt: null,
        updatedAt: nowIso(),
      };
    } else {
      const nextPeriodEnd = new Date(
        new Date(org.subscription.currentPeriodEnd).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      org.subscription = {
        ...org.subscription,
        currentPeriodEnd: nextPeriodEnd,
        nextInvoiceAt: nextPeriodEnd,
        updatedAt: nowIso(),
      };
    }

    return finalized;
  }

  finalizeInvoice(organizationId: string, invoiceId: string): InvoiceRecord | null {
    const org = this.getOrg(organizationId);
    const existing = org.invoices.get(invoiceId);
    if (!existing) return null;
    if (existing.status !== 'draft') {
      throw new AppError({
        code: 'INVOICE_NOT_DRAFT',
        messageNl: 'Alleen conceptfacturen kunnen worden bevestigd.',
        category: 'CONFLICT',
      });
    }
    const updated: InvoiceRecord = {
      ...existing,
      status: 'open',
      pdfAvailable: true,
      ublXmlAvailable: true,
      updatedAt: nowIso(),
    };
    org.invoices.set(invoiceId, updated);
    return updated;
  }

  markInvoicePaid(
    organizationId: string,
    invoiceId: string,
    options?: { internalNote?: string },
  ): InvoiceRecord | null {
    const org = this.getOrg(organizationId);
    const existing = org.invoices.get(invoiceId);
    if (!existing) return null;

    const updated: InvoiceRecord = {
      ...existing,
      status: 'paid',
      paidAt: nowIso(),
      internalNote: options?.internalNote?.trim() || existing.internalNote,
      updatedAt: nowIso(),
    };
    org.invoices.set(invoiceId, updated);
    return updated;
  }

  listAllInvoices(): readonly (InvoiceRecord & { organizationName: string })[] {
    const results: (InvoiceRecord & { organizationName: string })[] = [];
    for (const org of this.orgs.values()) {
      for (const invoice of org.invoices.values()) {
        results.push({ ...invoice, organizationName: org.profile.legalName });
      }
    }
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  sendInAppNotification(input: {
    organizationId: string;
    title: string;
    body: string;
    sentByUserId: string;
    kind?: InAppNotificationRecord['kind'];
  }): InAppNotificationRecord {
    this.getOrg(input.organizationId);
    const notification: InAppNotificationRecord = {
      id: createId(),
      organizationId: input.organizationId,
      title: input.title.trim(),
      body: input.body.trim(),
      kind: input.kind ?? inferNotificationKind(input.title, input.body),
      sentByUserId: input.sentByUserId,
      createdAt: nowIso(),
      readAt: null,
    };
    this.inAppNotifications.unshift(notification);
    return notification;
  }

  listInAppNotifications(organizationId?: string): readonly InAppNotificationRecord[] {
    const all = organizationId
      ? this.inAppNotifications.filter((n) => n.organizationId === organizationId)
      : this.inAppNotifications;
    return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  markInAppNotificationRead(organizationId: string, notificationId: string): InAppNotificationRecord | null {
    const notification = this.inAppNotifications.find(
      (n) => n.id === notificationId && n.organizationId === organizationId,
    );
    if (!notification) return null;
    if (!notification.readAt) {
      (notification as { readAt: string | null }).readAt = nowIso();
    }
    return notification;
  }

  recordBillingEvent(
    organizationId: string,
    input: { eventType: string; payload: Record<string, unknown>; provider: BillingEventProvider },
  ): BillingEventRecord {
    const org = this.getOrg(organizationId);
    const event: BillingEventRecord = {
      id: createId(),
      organizationId,
      eventType: input.eventType,
      payload: input.payload,
      provider: input.provider,
      createdAt: nowIso(),
    };
    org.billingEvents.unshift(event);
    return event;
  }

  listBillingEvents(organizationId: string): readonly BillingEventRecord[] {
    return [...this.getOrg(organizationId).billingEvents];
  }

  listThreads(organizationId: string): readonly SupportThreadRecord[] {
    return [...this.getOrg(organizationId).threads.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  listAllThreadsForPlatform(): readonly (SupportThreadRecord & {
    messageCount: number;
    organizationName: string;
  })[] {
    const results: (SupportThreadRecord & { messageCount: number; organizationName: string })[] = [];
    for (const org of this.orgs.values()) {
      for (const thread of org.threads.values()) {
        results.push({
          ...thread,
          messageCount: org.messages.get(thread.id)?.length ?? 0,
          organizationName: org.profile.legalName,
        });
      }
    }
    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  createThread(
    organizationId: string,
    input: { subject: string; body: string; trademarkMatchId?: string },
    actorUserId: string,
    actorDisplayName: string,
  ): { thread: SupportThreadRecord; message: SupportMessageRecord } {
    const org = this.getOrg(organizationId);
    const now = nowIso();
    const threadId = createId();
    const participantId = createId();

    const thread: SupportThreadRecord = {
      id: threadId,
      organizationId,
      subject: input.subject,
      status: 'open',
      trademarkMatchId: input.trademarkMatchId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const participant: SupportParticipantRecord = {
      id: participantId,
      threadId,
      participantType: 'customer_user',
      displayName: actorDisplayName,
      actorUserId,
      joinedAt: now,
    };

    const message: SupportMessageRecord = {
      id: createId(),
      threadId,
      participantId,
      body: input.body,
      createdAt: now,
    };

    org.threads.set(threadId, thread);
    org.participants.set(participantId, participant);
    org.messages.set(threadId, [message]);
    return { thread, message };
  }

  getThread(
    organizationId: string,
    threadId: string,
  ): { thread: SupportThreadRecord; messages: readonly SupportMessageRecord[]; participants: readonly SupportParticipantRecord[] } | null {
    const org = this.getOrg(organizationId);
    const thread = org.threads.get(threadId);
    if (!thread) return null;

    const participants = [...org.participants.values()].filter((p) => p.threadId === threadId);
    const messages = org.messages.get(threadId) ?? [];
    return { thread, messages, participants };
  }

  addMessage(
    organizationId: string,
    threadId: string,
    body: string,
    actorUserId: string,
    actorDisplayName: string,
  ): SupportMessageRecord | null {
    const org = this.getOrg(organizationId);
    const thread = org.threads.get(threadId);
    if (!thread) return null;

    let participant = [...org.participants.values()].find(
      (p) => p.threadId === threadId && p.actorUserId === actorUserId && p.participantType === 'customer_user',
    );

    const now = nowIso();
    if (!participant) {
      participant = {
        id: createId(),
        threadId,
        participantType: 'customer_user',
        displayName: actorDisplayName,
        actorUserId,
        joinedAt: now,
      };
      org.participants.set(participant.id, participant);
    }

    const message: SupportMessageRecord = {
      id: createId(),
      threadId,
      participantId: participant.id,
      body,
      createdAt: now,
    };

    const messages = org.messages.get(threadId) ?? [];
    messages.push(message);
    org.messages.set(threadId, messages);
    thread.updatedAt = now;
    return message;
  }

  addPlatformMessage(
    threadId: string,
    body: string,
    actorUserId: string,
    actorDisplayName: string,
  ): SupportMessageRecord | null {
    let targetOrg: OrgData | null = null;
    let thread: SupportThreadRecord | null = null;

    for (const org of this.orgs.values()) {
      const found = org.threads.get(threadId);
      if (found) {
        targetOrg = org;
        thread = found;
        break;
      }
    }
    if (!targetOrg || !thread) return null;

    let participant = [...targetOrg.participants.values()].find(
      (p) => p.threadId === threadId && p.participantType === 'platform_operator',
    );

    const now = nowIso();
    if (!participant) {
      participant = {
        id: createId(),
        threadId,
        participantType: 'platform_operator',
        displayName: actorDisplayName,
        actorUserId,
        joinedAt: now,
      };
      targetOrg.participants.set(participant.id, participant);
    }

    const message: SupportMessageRecord = {
      id: createId(),
      threadId,
      participantId: participant.id,
      body,
      createdAt: now,
    };

    const messages = targetOrg.messages.get(threadId) ?? [];
    messages.push(message);
    targetOrg.messages.set(threadId, messages);
    thread.updatedAt = now;
    return message;
  }

  assertCanAddWatchedTrademark(organizationId: string, currentActiveCount: number): void {
    const denial = canAddWatchedTrademark(this.getEntitlements(organizationId), currentActiveCount);
    if (denial) entitlementError(denial);
  }
}

function inferNotificationKind(
  title: string,
  body: string,
): InAppNotificationRecord['kind'] {
  const text = `${title} ${body}`.toLowerCase();
  if (text.includes('connector') || text.includes('offline') || text.includes('register')) return 'connector_down';
  if (text.includes('factuur') || text.includes('invoice') || text.includes('betaling')) return 'invoice';
  if (text.includes('rapport') || text.includes('merkonderzoek') || text.includes('onderzoek')) return 'report_ready';
  if (text.includes('match')) return 'match';
  if (text.includes('admin') || text.includes('merkwacht')) return 'admin';
  return 'general';
}

export function createOrgBillingChatStore(organizationId: string, settingsEmail?: string): OrgBillingChatStore {
  return new OrgBillingChatStore(organizationId, settingsEmail);
}
