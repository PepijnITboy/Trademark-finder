import { DEV_SEED_IDS } from '@merkwacht/database';
import {
  DEFAULT_PLAN_CATALOG,
  ENTITLEMENT_MESSAGES_NL,
  PLAN_CHANGE_MESSAGES_NL,
  ROLE_GUARD_MESSAGES_NL,
  assertRoleMutationAllowed,
  canAddNotificationRecipient,
  canAddWatchedTrademark,
  evaluatePlanChange,
  isAdminRole,
  resolveEntitlements,
  type FeatureFlag,
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
  InvoiceRecord,
  NotificationRecipientRecord,
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

  constructor(primaryOrganizationId: string, settingsEmail = 'merkbewaking@voorbeeld-merkenbureau.nl') {
    this.seedOrg(primaryOrganizationId, settingsEmail);
  }

  private seedOrg(organizationId: string, settingsEmail: string): void {
    const now = nowIso();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const ownerId = DEV_SEED_IDS.userId;
    const juristId = createId();

    const members = new Map<string, OrganizationMemberRecord>([
      [
        ownerId,
        {
          id: ownerId,
          organizationId,
          email: 'admin@voorbeeld-merkenbureau.nl',
          displayName: 'Demo Admin',
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
          organizationId,
          email: 'jurist@voorbeeld-merkenbureau.nl',
          displayName: 'Demo Jurist',
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
          organizationId,
          email: settingsEmail,
          digestFrequency: 'DAILY',
          minScoreThreshold: 50,
          isActive: true,
          watchedTrademarkIds: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    ]);

    const openInvoiceId = createId();
    const paidInvoiceId = createId();
    const invoices = new Map<string, InvoiceRecord>([
      [
        openInvoiceId,
        {
          id: openInvoiceId,
          organizationId,
          number: 'INV-2026-0042',
          status: 'open',
          amountCents: 4900,
          description: 'Merkwacht Starter — maandelijks abonnement',
          paidAt: null,
          pdfAvailable: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      [
        paidInvoiceId,
        {
          id: paidInvoiceId,
          organizationId,
          number: 'INV-2026-0041',
          status: 'paid',
          amountCents: 4900,
          description: 'Merkwacht Starter — maandelijks abonnement',
          paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          pdfAvailable: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    ]);

    this.orgs.set(organizationId, {
      profile: {
        organizationId,
        legalName: 'Lumaro B.V.',
        addressLine: 'Herengracht 124',
        postalCode: '1015 BT',
        city: 'Amsterdam',
        country: 'NL',
        kvkNumber: '12345678',
        contactEmail: settingsEmail,
        billingEmail: settingsEmail,
        phone: '+31 20 123 4567',
        latitude: 52.377956,
        longitude: 4.89707,
        updatedAt: now,
      },
      members,
      recipients,
      subscription: {
        organizationId,
        plan: 'starter',
        status: 'active',
        pendingPlan: null,
        currentPeriodEnd: periodEnd,
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
      digestFrequency: NotificationRecipientRecord['digestFrequency'];
      minScoreThreshold?: number;
      allWatches?: boolean;
      watchedTrademarkIds?: string[];
    },
    activeWatchedTrademarkIds: readonly string[],
  ): NotificationRecipientRecord {
    const org = this.getOrg(organizationId);
    const entitlements = this.getEntitlements(organizationId);
    const denial = canAddNotificationRecipient(entitlements, org.recipients.size);
    if (denial) entitlementError(denial);

    const useAllWatches = input.allWatches !== false && (!input.watchedTrademarkIds || input.watchedTrademarkIds.length === 0);
    const watchedTrademarkIds = useAllWatches ? [...activeWatchedTrademarkIds] : [...(input.watchedTrademarkIds ?? [])];

    const now = nowIso();
    const record: NotificationRecipientRecord = {
      id: createId(),
      organizationId,
      email: input.email,
      digestFrequency: input.digestFrequency,
      minScoreThreshold: input.minScoreThreshold ?? 50,
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
      digestFrequency?: NotificationRecipientRecord['digestFrequency'];
      minScoreThreshold?: number;
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

    const updated: NotificationRecipientRecord = {
      ...existing,
      digestFrequency: patch.digestFrequency ?? existing.digestFrequency,
      minScoreThreshold: patch.minScoreThreshold ?? existing.minScoreThreshold,
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

  changePlan(
    organizationId: string,
    targetPlan: SubscriptionPlan,
    counts: { activeWatchedCount: number; recipientCount: number },
  ): SubscriptionStateRecord {
    const org = this.getOrg(organizationId);
    const current = this.getEntitlements(organizationId);
    const targetRecord = this.planCatalog.get(targetPlan);
    if (!targetRecord) {
      throw new AppError({
        code: 'PLAN_NOT_FOUND',
        messageNl: 'Het gekozen abonnement bestaat niet.',
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

  getInvoice(organizationId: string, invoiceId: string): InvoiceRecord | null {
    return this.getOrg(organizationId).invoices.get(invoiceId) ?? null;
  }

  markInvoicePaid(organizationId: string, invoiceId: string): InvoiceRecord | null {
    const org = this.getOrg(organizationId);
    const existing = org.invoices.get(invoiceId);
    if (!existing) return null;

    const updated: InvoiceRecord = {
      ...existing,
      status: 'paid',
      paidAt: nowIso(),
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

export function createOrgBillingChatStore(organizationId: string, settingsEmail?: string): OrgBillingChatStore {
  return new OrgBillingChatStore(organizationId, settingsEmail);
}
