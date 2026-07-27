import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type {
  PlanCatalogRecord,
  PlatformChatThreadRecord,
  SubscriptionPlan,
  SupportMessageRecord,
  UpdatePlanCatalogInput,
} from './types';

async function fetchPlatformPlans(): Promise<readonly PlanCatalogRecord[]> {
  const { plans } = await apiRequest<{ plans: readonly PlanCatalogRecord[] }>('/api/platform/org/plans');
  return plans;
}

async function fetchPlatformChatThreads(): Promise<readonly PlatformChatThreadRecord[]> {
  const { threads } = await apiRequest<{ threads: readonly PlatformChatThreadRecord[] }>(
    '/api/platform/org/chat/threads',
  );
  return threads;
}

export function usePlatformPlans() {
  return useQuery({ queryKey: queryKeys.platformPlans, queryFn: fetchPlatformPlans });
}

export function useUpdatePlatformPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, patch }: { code: SubscriptionPlan; patch: UpdatePlanCatalogInput }) =>
      apiRequest<{ plan: PlanCatalogRecord }>(`/api/platform/org/plans/${code}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.platformPlans });
    },
  });
}

export function usePlatformChatThreads() {
  return useQuery({ queryKey: queryKeys.platformChatThreads, queryFn: fetchPlatformChatThreads });
}

export function useSendPlatformChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, body }: { threadId: string; body: string }) =>
      apiRequest<{ message: SupportMessageRecord }>(`/api/platform/org/chat/threads/${threadId}/messages`, {
        method: 'POST',
        body: { body },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.platformChatThreads });
    },
  });
}
