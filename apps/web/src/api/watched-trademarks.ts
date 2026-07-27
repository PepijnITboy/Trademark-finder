import type { WatchedTrademarkStatus } from '@merkwacht/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type {
  CreateWatchedTrademarkInput,
  LookupResponse,
  WatchedTrademarkRecord,
} from './types';

async function fetchWatchedTrademarks(): Promise<readonly WatchedTrademarkRecord[]> {
  const { watchedTrademarks } = await apiRequest<{ watchedTrademarks: readonly WatchedTrademarkRecord[] }>(
    '/api/v1/watched-trademarks',
  );
  return watchedTrademarks;
}

async function fetchWatchedTrademark(id: string): Promise<WatchedTrademarkRecord> {
  const { watchedTrademark } = await apiRequest<{ watchedTrademark: WatchedTrademarkRecord }>(
    `/api/v1/watched-trademarks/${id}`,
  );
  return watchedTrademark;
}

export function useWatchedTrademarks() {
  return useQuery({ queryKey: queryKeys.watchedTrademarks.all, queryFn: fetchWatchedTrademarks });
}

export function useWatchedTrademark(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: queryKeys.watchedTrademarks.detail(toValue(id)),
    queryFn: () => fetchWatchedTrademark(toValue(id)),
    enabled: () => Boolean(toValue(id)),
  });
}

export function useLookupWatchedTrademark() {
  return useMutation({
    mutationFn: (query: string) =>
      apiRequest<LookupResponse>('/api/v1/watched-trademarks/lookup', {
        method: 'POST',
        body: { query, jurisdictions: ['BENELUX'] },
      }),
  });
}

export function useCreateWatchedTrademark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWatchedTrademarkInput) =>
      apiRequest<{ watchedTrademark: WatchedTrademarkRecord }>('/api/v1/watched-trademarks', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.watchedTrademarks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateWatchedTrademarkSettings(id: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { label?: string; notes?: string | null }) =>
      apiRequest<{ watchedTrademark: WatchedTrademarkRecord }>(`/api/v1/watched-trademarks/${toValue(id)}/settings`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.watchedTrademarks.detail(toValue(id)) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.watchedTrademarks.all });
    },
  });
}

export function useSetWatchedTrademarkStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pause' | 'resume' | 'archive' }) =>
      apiRequest<{ watchedTrademark: WatchedTrademarkRecord }>(`/api/v1/watched-trademarks/${id}/${action}`, {
        method: 'POST',
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.watchedTrademarks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.watchedTrademarks.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.archive });
    },
  });
}

export const WATCHED_TRADEMARK_STATUS_LABELS_NL: Readonly<Record<WatchedTrademarkStatus, string>> = {
  active: 'Actief',
  paused: 'Gepauzeerd',
  expired: 'Verlopen',
  archived: 'Gearchiveerd',
};
