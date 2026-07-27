export const FEATURE_FLAGS = [
  'ai_enrichment',
  'pdf_export',
  'csv_export',
  'email_notifications',
  'multi_register_watch',
  'platform_access',
] as const;
/** Flags gating access to specific product capabilities. */
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export const SUBSCRIPTION_PLANS = ['starter', 'pro', 'agency'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Resolved, effective entitlements for an organization: the combination of
 * its `subscription.plan` defaults and any manual `feature_entitlement`
 * overrides. Computed server-side; never trust a client-supplied copy of
 * this object for authorization decisions.
 */
export interface SubscriptionEntitlements {
  readonly organizationId: string;
  readonly plan: SubscriptionPlan;
  readonly status: SubscriptionStatus;
  readonly maxWatchedTrademarks: number;
  readonly features: Readonly<Record<FeatureFlag, boolean>>;
}
