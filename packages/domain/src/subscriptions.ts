export const FEATURE_FLAGS = [
  'ai_enrichment',
  'pdf_export',
  'csv_export',
  'email_notifications',
  'multi_register_watch',
  'platform_access',
  'merkrechten_chat',
] as const;
/** Flags gating access to specific product capabilities. */
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/** Five configurable plan codes (platform can rename display labels). */
export const SUBSCRIPTION_PLANS = ['basis', 'starter', 'plus', 'pro', 'enterprise'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

/** Legacy codes still accepted when reading old rows. */
export const LEGACY_SUBSCRIPTION_PLANS = ['agency'] as const;

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'pending_downgrade',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUPPORT_TIERS = ['basis', 'standaard', 'prioriteit', 'dedicated'] as const;
export type SupportTier = (typeof SUPPORT_TIERS)[number];

export interface PlanLimits {
  readonly maxWatchedTrademarks: number;
  readonly maxNotificationEmails: number;
  readonly supportTier: SupportTier;
  readonly features: Readonly<Record<FeatureFlag, boolean>>;
  readonly displayNameNl: string;
  readonly priceMonthlyCents: number;
}

const allFeaturesOff: Record<FeatureFlag, boolean> = {
  ai_enrichment: false,
  pdf_export: false,
  csv_export: true,
  email_notifications: true,
  multi_register_watch: false,
  platform_access: false,
  merkrechten_chat: false,
};

/** Default catalog — platform may override persisted rows. */
export const DEFAULT_PLAN_CATALOG: Readonly<Record<SubscriptionPlan, PlanLimits>> = {
  basis: {
    displayNameNl: 'Basis',
    priceMonthlyCents: 2900,
    maxWatchedTrademarks: 1,
    maxNotificationEmails: 2,
    supportTier: 'basis',
    features: { ...allFeaturesOff, csv_export: true, email_notifications: true },
  },
  starter: {
    displayNameNl: 'Starter',
    priceMonthlyCents: 4900,
    maxWatchedTrademarks: 3,
    maxNotificationEmails: 5,
    supportTier: 'standaard',
    features: {
      ...allFeaturesOff,
      csv_export: true,
      email_notifications: true,
      ai_enrichment: true,
    },
  },
  plus: {
    displayNameNl: 'Plus',
    priceMonthlyCents: 9900,
    maxWatchedTrademarks: 10,
    maxNotificationEmails: 15,
    supportTier: 'standaard',
    features: {
      ...allFeaturesOff,
      csv_export: true,
      email_notifications: true,
      ai_enrichment: true,
      pdf_export: true,
      multi_register_watch: true,
    },
  },
  pro: {
    displayNameNl: 'Pro',
    priceMonthlyCents: 19900,
    maxWatchedTrademarks: 30,
    maxNotificationEmails: 40,
    supportTier: 'prioriteit',
    features: {
      ...allFeaturesOff,
      csv_export: true,
      email_notifications: true,
      ai_enrichment: true,
      pdf_export: true,
      multi_register_watch: true,
      merkrechten_chat: true,
    },
  },
  enterprise: {
    displayNameNl: 'Enterprise',
    priceMonthlyCents: 39900,
    maxWatchedTrademarks: 100,
    maxNotificationEmails: 100,
    supportTier: 'dedicated',
    features: {
      ai_enrichment: true,
      pdf_export: true,
      csv_export: true,
      email_notifications: true,
      multi_register_watch: true,
      platform_access: false,
      merkrechten_chat: true,
    },
  },
};

/**
 * Resolved, effective entitlements for an organization: the combination of
 * its subscription plan defaults and any manual feature overrides.
 * Computed server-side; never trust a client-supplied copy for authorization.
 */
export interface SubscriptionEntitlements {
  readonly organizationId: string;
  readonly plan: SubscriptionPlan;
  readonly status: SubscriptionStatus;
  readonly maxWatchedTrademarks: number;
  readonly maxNotificationEmails: number;
  readonly supportTier: SupportTier;
  readonly features: Readonly<Record<FeatureFlag, boolean>>;
  readonly pendingPlan: SubscriptionPlan | null;
  readonly currentPeriodEnd: string | null;
}

export type EntitlementDenialReason =
  | 'watched_trademark_limit'
  | 'notification_email_limit'
  | 'feature_disabled'
  | 'subscription_inactive';

export const ENTITLEMENT_MESSAGES_NL: Record<EntitlementDenialReason, string> = {
  watched_trademark_limit:
    'U heeft het maximum aantal bewaakte merken voor uw abonnement bereikt. Upgrade om meer merken toe te voegen.',
  notification_email_limit:
    'U heeft het maximum aantal meldingsadressen voor uw abonnement bereikt. Upgrade of verwijder een adres.',
  feature_disabled: 'Deze functie hoort niet bij uw huidige abonnement. Upgrade om verder te gaan.',
  subscription_inactive: 'Uw abonnement is niet actief. Neem contact op met Merkwacht of vernieuw uw betaling.',
};

export function isSubscriptionUsable(status: SubscriptionStatus): boolean {
  return status === 'trialing' || status === 'active' || status === 'pending_downgrade';
}

export function canAddWatchedTrademark(
  entitlements: SubscriptionEntitlements,
  currentActiveCount: number,
): EntitlementDenialReason | null {
  if (!isSubscriptionUsable(entitlements.status)) return 'subscription_inactive';
  if (currentActiveCount >= entitlements.maxWatchedTrademarks) return 'watched_trademark_limit';
  return null;
}

export function canAddNotificationRecipient(
  entitlements: SubscriptionEntitlements,
  currentCount: number,
): EntitlementDenialReason | null {
  if (!isSubscriptionUsable(entitlements.status)) return 'subscription_inactive';
  const hardCap = Math.min(100, entitlements.maxNotificationEmails);
  if (currentCount >= hardCap) return 'notification_email_limit';
  return null;
}

export function requireFeature(
  entitlements: SubscriptionEntitlements,
  flag: FeatureFlag,
): EntitlementDenialReason | null {
  if (!isSubscriptionUsable(entitlements.status)) return 'subscription_inactive';
  if (!entitlements.features[flag]) return 'feature_disabled';
  return null;
}

export type PlanChangeDenialReason =
  | 'downgrade_exceeds_watches'
  | 'downgrade_exceeds_emails'
  | 'same_plan'
  | 'subscription_inactive';

export const PLAN_CHANGE_MESSAGES_NL: Record<PlanChangeDenialReason, string> = {
  downgrade_exceeds_watches:
    'Downgraden kan niet: u heeft meer actieve merken dan het lagere abonnement toestaat. Archiveer eerst merken.',
  downgrade_exceeds_emails:
    'Downgraden kan niet: u heeft meer meldingsadressen dan het lagere abonnement toestaat. Verwijder eerst adressen.',
  same_plan: 'U zit al op dit abonnement.',
  subscription_inactive: 'Uw abonnement is niet actief genoeg om te wijzigen.',
};

export function evaluatePlanChange(input: {
  readonly current: SubscriptionEntitlements;
  readonly targetPlan: SubscriptionPlan;
  readonly targetLimits: PlanLimits;
  readonly activeWatchedCount: number;
  readonly recipientCount: number;
}): { readonly ok: true; readonly immediate: boolean } | { readonly ok: false; readonly reason: PlanChangeDenialReason } {
  if (!isSubscriptionUsable(input.current.status) && input.current.status !== 'past_due') {
    return { ok: false, reason: 'subscription_inactive' };
  }
  if (input.targetPlan === input.current.plan && input.current.status !== 'pending_downgrade') {
    return { ok: false, reason: 'same_plan' };
  }

  const isDowngrade =
    input.targetLimits.maxWatchedTrademarks < input.current.maxWatchedTrademarks ||
    input.targetLimits.priceMonthlyCents < DEFAULT_PLAN_CATALOG[input.current.plan].priceMonthlyCents;

  if (isDowngrade) {
    if (input.activeWatchedCount > input.targetLimits.maxWatchedTrademarks) {
      return { ok: false, reason: 'downgrade_exceeds_watches' };
    }
    if (input.recipientCount > Math.min(100, input.targetLimits.maxNotificationEmails)) {
      return { ok: false, reason: 'downgrade_exceeds_emails' };
    }
    return { ok: true, immediate: false };
  }

  return { ok: true, immediate: true };
}

export function resolveEntitlements(input: {
  readonly organizationId: string;
  readonly plan: SubscriptionPlan;
  readonly status: SubscriptionStatus;
  readonly limits: PlanLimits;
  readonly featureOverrides?: Partial<Record<FeatureFlag, boolean>>;
  readonly pendingPlan?: SubscriptionPlan | null;
  readonly currentPeriodEnd?: string | null;
}): SubscriptionEntitlements {
  const features = { ...input.limits.features, ...input.featureOverrides };
  return {
    organizationId: input.organizationId,
    plan: input.plan,
    status: input.status,
    maxWatchedTrademarks: input.limits.maxWatchedTrademarks,
    maxNotificationEmails: Math.min(100, input.limits.maxNotificationEmails),
    supportTier: input.limits.supportTier,
    features,
    pendingPlan: input.pendingPlan ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
  };
}
