import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type {
  InAppNotificationRecord,
  PlanCatalogRecord,
  PlatformChatThreadRecord,
  PlatformOrganizationListItem,
  SubscriptionPlan,
  SupportMessageRecord,
  UpdatePlanCatalogInput,
} from './types';

export interface PlatformOrganizationDetail {
  readonly profile: {
    readonly organizationId: string;
    readonly legalName: string;
    readonly addressLine: string;
    readonly postalCode: string;
    readonly city: string;
    readonly country: string;
    readonly kvkNumber: string;
    readonly contactEmail: string;
    readonly billingEmail: string;
    readonly phone: string;
  };
  readonly subscription: {
    readonly plan: SubscriptionPlan;
    readonly status: string;
    readonly pendingPlan: SubscriptionPlan | null;
    readonly currentPeriodEnd: string;
  };
  readonly entitlements: {
    readonly maxWatchedTrademarks: number;
    readonly maxNotificationEmails: number;
  };
  readonly members: readonly {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly role: string;
  }[];
  readonly recipients: readonly {
    readonly id: string;
    readonly email: string;
    readonly mode: string;
    readonly isActive: boolean;
    readonly watchedTrademarkIds: readonly string[];
    readonly digestCadence: string | null;
    readonly minScoreThreshold: number | null;
  }[];
  readonly invoices: readonly {
    readonly id: string;
    readonly number: string;
    readonly status: 'draft' | 'open' | 'paid' | 'void';
    readonly amountCents: number;
    readonly exVatCents?: number;
    readonly btwCents?: number;
    readonly description: string;
    readonly paidAt: string | null;
    readonly dueAt?: string | null;
    readonly internalNote: string | null;
    readonly pdfAvailable?: boolean;
    readonly ublXmlAvailable?: boolean;
    readonly createdAt: string;
  }[];
  readonly threads: readonly {
    readonly id: string;
    readonly subject: string;
    readonly status: string;
    readonly updatedAt: string;
  }[];
  readonly watchedTrademarks: readonly {
    readonly id: string;
    readonly label: string;
    readonly registryCode: string;
    readonly status: string;
    readonly watchSettings?: { readonly minScoreThreshold?: number };
  }[];
  readonly matchCount: number;
  readonly nameResearchOrders: readonly {
    readonly id: string;
    readonly markText: string;
    readonly status: string;
    readonly priceCents: number;
    readonly creditUsed: boolean;
    readonly scopes: readonly { readonly registryCode: string; readonly niceClasses: readonly number[] }[];
  }[];
  readonly notifications: readonly InAppNotificationRecord[];
  readonly auditSnippet: readonly {
    readonly id: string;
    readonly occurredAt: string;
    readonly action: string;
  }[];
}

export interface PlatformImportSyncRecord {
  readonly registryCode: string;
  readonly displayNameNl: string;
  readonly purpose: 'watch' | 'name_research';
  readonly lastSyncAt: string | null;
  readonly lastStatus: 'succeeded' | 'failed' | 'never';
  readonly lastFetchedCount: number | null;
  readonly affectedOrganizationIds: readonly string[];
  readonly yesterdayStatus?: 'ok' | 'fail' | 'pending' | 'never';
  readonly todayStatus?: 'ok' | 'fail' | 'pending' | 'never';
  readonly cadenceNl?: string;
}

async function fetchPlatformPlans(): Promise<readonly PlanCatalogRecord[]> {
  const { plans } = await apiRequest<{ plans: readonly PlanCatalogRecord[] }>('/api/platform/org/plans');
  return plans;
}

async function fetchPlatformOrganizations(): Promise<readonly PlatformOrganizationListItem[]> {
  const { organizations } = await apiRequest<{ organizations: readonly PlatformOrganizationListItem[] }>(
    '/api/platform/organizations',
  );
  return organizations;
}

async function fetchPlatformOrganization(id: string): Promise<PlatformOrganizationDetail> {
  const { organization } = await apiRequest<{ organization: PlatformOrganizationDetail }>(
    `/api/platform/organizations/${id}`,
  );
  return organization;
}

async function fetchPlatformChatThreads(): Promise<readonly PlatformChatThreadRecord[]> {
  const { threads } = await apiRequest<{ threads: readonly PlatformChatThreadRecord[] }>(
    '/api/platform/org/chat/threads',
  );
  return threads;
}

async function fetchPlatformImportSyncs(): Promise<readonly PlatformImportSyncRecord[]> {
  const { syncs } = await apiRequest<{ syncs: readonly PlatformImportSyncRecord[] }>('/api/platform/import-syncs');
  return syncs;
}

async function fetchPlatformNotifications(): Promise<readonly InAppNotificationRecord[]> {
  const { notifications } = await apiRequest<{ notifications: readonly InAppNotificationRecord[] }>(
    '/api/platform/org/notifications',
  );
  return notifications;
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

export function usePlatformOrganizations() {
  return useQuery({ queryKey: queryKeys.platformOrganizations, queryFn: fetchPlatformOrganizations });
}

export function usePlatformOrganization(id: () => string) {
  return useQuery({
    queryKey: queryKeys.platformOrganization(id()),
    queryFn: () => fetchPlatformOrganization(id()),
    enabled: () => Boolean(id()),
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

export function useMarkPlatformInvoicePaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      invoiceId,
      internalNote,
    }: {
      organizationId: string;
      invoiceId: string;
      internalNote: string;
    }) =>
      apiRequest(`/api/platform/org/billing/${organizationId}/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        body: { internalNote },
      }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.platformBilling });
      void queryClient.invalidateQueries({ queryKey: queryKeys.platformOrganization(vars.organizationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.platformOrganizations });
    },
  });
}

export function useForceOrganizationSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      patch,
    }: {
      organizationId: string;
      patch: { plan?: SubscriptionPlan; status?: string; pendingPlan?: SubscriptionPlan | null };
    }) =>
      apiRequest(`/api/platform/org/organizations/${organizationId}/subscription/force`, {
        method: 'POST',
        body: patch,
      }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.platformOrganization(vars.organizationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.platformOrganizations });
    },
  });
}

export function usePlatformImportSyncs() {
  return useQuery({ queryKey: queryKeys.platformImportSyncs, queryFn: fetchPlatformImportSyncs });
}

export function usePlatformNotificationsLog() {
  return useQuery({ queryKey: queryKeys.platformNotifications, queryFn: fetchPlatformNotifications });
}

export function useSendPlatformNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationId: string; title: string; body: string }) =>
      apiRequest<{ notification: InAppNotificationRecord }>('/api/platform/org/notifications', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.platformNotifications });
    },
  });
}

function invalidateOrg(queryClient: ReturnType<typeof useQueryClient>, organizationId: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.platformOrganization(organizationId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.platformOrganizations });
}

export function useUpdatePlatformOrganizationProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      patch,
    }: {
      organizationId: string;
      patch: Partial<PlatformOrganizationDetail['profile']>;
    }) =>
      apiRequest(`/api/platform/org/organizations/${organizationId}/profile`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: (_data, vars) => invalidateOrg(queryClient, vars.organizationId),
  });
}

export function useCreatePlatformMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      input,
    }: {
      organizationId: string;
      input: { email: string; displayName: string; role: 'admin' | 'jurist' };
    }) =>
      apiRequest(`/api/platform/org/organizations/${organizationId}/members`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (_data, vars) => invalidateOrg(queryClient, vars.organizationId),
  });
}

export function useUpdatePlatformMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      memberId,
      patch,
    }: {
      organizationId: string;
      memberId: string;
      patch: { displayName?: string; role?: 'admin' | 'jurist' };
    }) =>
      apiRequest(`/api/platform/org/organizations/${organizationId}/members/${memberId}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: (_data, vars) => invalidateOrg(queryClient, vars.organizationId),
  });
}

export function useRemovePlatformMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, memberId }: { organizationId: string; memberId: string }) =>
      apiRequest(`/api/platform/org/organizations/${organizationId}/members/${memberId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, vars) => invalidateOrg(queryClient, vars.organizationId),
  });
}

export function useCreatePlatformRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      input,
    }: {
      organizationId: string;
      input: {
        email: string;
        mode: 'threshold' | 'digest';
        digestCadence?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
        minScoreThreshold?: number | null;
        allWatches?: boolean;
      };
    }) =>
      apiRequest(`/api/platform/org/organizations/${organizationId}/recipients`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (_data, vars) => invalidateOrg(queryClient, vars.organizationId),
  });
}

export function useUpdatePlatformRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      recipientId,
      patch,
    }: {
      organizationId: string;
      recipientId: string;
      patch: Record<string, unknown>;
    }) =>
      apiRequest(`/api/platform/org/organizations/${organizationId}/recipients/${recipientId}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: (_data, vars) => invalidateOrg(queryClient, vars.organizationId),
  });
}

export function useDeletePlatformRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, recipientId }: { organizationId: string; recipientId: string }) =>
      apiRequest(`/api/platform/org/organizations/${organizationId}/recipients/${recipientId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, vars) => invalidateOrg(queryClient, vars.organizationId),
  });
}

export function useUpdatePlatformWatchSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      watchId,
      patch,
    }: {
      organizationId: string;
      watchId: string;
      patch: { minScoreThreshold?: number };
    }) =>
      apiRequest(`/api/platform/org/organizations/${organizationId}/watches/${watchId}/settings`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: (_data, vars) => invalidateOrg(queryClient, vars.organizationId),
  });
}

export function useSetPlatformWatchStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      watchId,
      status,
    }: {
      organizationId: string;
      watchId: string;
      status: 'active' | 'paused' | 'archived';
    }) =>
      apiRequest(`/api/platform/org/organizations/${organizationId}/watches/${watchId}/status`, {
        method: 'POST',
        body: { status },
      }),
    onSuccess: (_data, vars) => invalidateOrg(queryClient, vars.organizationId),
  });
}

export function usePlatformOrgThread(organizationId: () => string, threadId: () => string | null) {
  return useQuery({
    queryKey: ['platform', 'org', 'thread', organizationId(), threadId()],
    queryFn: () =>
      apiRequest<{
        thread: {
          thread: PlatformChatThreadRecord;
          messages: readonly SupportMessageRecord[];
        };
      }>(`/api/platform/org/organizations/${organizationId()}/chat/threads/${threadId()}`).then((r) => r.thread),
    enabled: () => Boolean(organizationId() && threadId()),
  });
}
