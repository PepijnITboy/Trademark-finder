import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type {
  PlanCatalogRecord,
  SubscriptionEntitlements,
  SubscriptionPlan,
  SubscriptionStateRecord,
} from './types';

export interface SubscriptionResponse {
  readonly subscription: SubscriptionStateRecord;
  readonly entitlements: SubscriptionEntitlements;
}

async function fetchSubscription(): Promise<SubscriptionResponse> {
  return apiRequest<SubscriptionResponse>('/api/v1/subscription');
}

async function fetchSubscriptionPlans(): Promise<readonly PlanCatalogRecord[]> {
  const { plans } = await apiRequest<{ plans: readonly PlanCatalogRecord[] }>('/api/v1/subscription/plans');
  return plans;
}

export function useSubscription() {
  return useQuery({ queryKey: queryKeys.subscription.current, queryFn: fetchSubscription });
}

export function useSubscriptionPlans() {
  return useQuery({ queryKey: queryKeys.subscription.plans, queryFn: fetchSubscriptionPlans });
}

export function useChangePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (plan: SubscriptionPlan) =>
      apiRequest<SubscriptionResponse>('/api/v1/subscription/change-plan', {
        method: 'POST',
        body: { plan },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscription.current });
    },
  });
}

export const SUBSCRIPTION_STATUS_LABELS_NL = {
  trialing: 'Proefperiode',
  active: 'Actief',
  past_due: 'Betaling achterstallig',
  canceled: 'Opgezegd',
  pending_downgrade: 'Downgrade gepland',
} as const satisfies Record<SubscriptionStateRecord['status'], string>;

export const SUPPORT_TIER_LABELS_NL = {
  basis: 'Basis',
  standaard: 'Standaard',
  prioriteit: 'Prioriteit',
  dedicated: 'Dedicated',
} as const satisfies Record<SubscriptionEntitlements['supportTier'], string>;

export const FEATURE_LABELS_NL = {
  ai_enrichment: 'AI-verrijking',
  pdf_export: 'PDF-export',
  csv_export: 'CSV-export',
  email_notifications: 'E-mailmeldingen',
  multi_register_watch: 'Meerdere registers',
  platform_access: 'Platformtoegang',
  merkrechten_chat: 'Merkrechten-chat',
} as const satisfies Record<keyof SubscriptionEntitlements['features'], string>;

export const PLAN_ORDER: readonly SubscriptionPlan[] = ['basis', 'starter', 'plus', 'pro', 'enterprise'];
