import type { MatchQueue, MatchStatus } from '@merkwacht/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiRequest, apiResourceUrl } from './client';
import { queryKeys } from './keys';
import type { MatchNoteRecord, TrademarkMatchRecord } from './types';

export type MatchListParams = {
  status?: MatchStatus;
  queue?: MatchQueue;
};

function listScope(params?: MatchListParams): string {
  if (params?.queue) return `queue:${params.queue}`;
  if (params?.status) return `status:${params.status}`;
  return 'ALL';
}

async function fetchMatches(params?: MatchListParams): Promise<readonly TrademarkMatchRecord[]> {
  const { matches } = await apiRequest<{ matches: readonly TrademarkMatchRecord[] }>('/api/v1/matches', {
    query: params?.queue ? { queue: params.queue } : params?.status ? { status: params.status } : undefined,
  });
  return matches;
}

async function fetchMatch(id: string): Promise<TrademarkMatchRecord> {
  const { match } = await apiRequest<{ match: TrademarkMatchRecord }>(`/api/v1/matches/${id}`);
  return match;
}

export function useMatches(params?: MaybeRefOrGetter<MatchListParams | undefined>) {
  return useQuery({
    queryKey: computed(() => queryKeys.matches.all(listScope(toValue(params)))),
    queryFn: () => fetchMatches(toValue(params)),
  });
}

export function useMatch(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: queryKeys.matches.detail(toValue(id)),
    queryFn: () => fetchMatch(toValue(id)),
    enabled: () => Boolean(toValue(id)),
  });
}

function invalidateMatch(queryClient: ReturnType<typeof useQueryClient>, id: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(id) });
  void queryClient.invalidateQueries({ queryKey: ['matches'] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: queryKeys.deadlines });
  void queryClient.invalidateQueries({ queryKey: queryKeys.archive });
}

export function useUpdateMatchStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: MatchStatus }) =>
      apiRequest<{ match: TrademarkMatchRecord }>(`/api/v1/matches/${id}/status`, {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: (_data, variables) => invalidateMatch(queryClient, variables.id),
  });
}

export function useAcceptMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ match: TrademarkMatchRecord }>(`/api/v1/matches/${id}/accept`, { method: 'POST' }),
    onSuccess: (_data, id) => invalidateMatch(queryClient, id),
  });
}

export function useRejectMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest<{ match: TrademarkMatchRecord }>(`/api/v1/matches/${id}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: (_data, variables) => invalidateMatch(queryClient, variables.id),
  });
}

export function useArchiveMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ match: TrademarkMatchRecord }>(`/api/v1/matches/${id}/archive`, { method: 'POST' }),
    onSuccess: (_data, id) => invalidateMatch(queryClient, id),
  });
}

export function useAddMatchNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiRequest<{ note: MatchNoteRecord }>(`/api/v1/matches/${id}/notes`, {
        method: 'POST',
        body: { note },
      }),
    onSuccess: (_data, variables) => invalidateMatch(queryClient, variables.id),
  });
}

export function useRequestAdvisorReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ match: TrademarkMatchRecord }>(`/api/v1/matches/${id}/request-advisor`, { method: 'POST' }),
    onSuccess: (_data, id) => invalidateMatch(queryClient, id),
  });
}

export function matchExportUrl(id: string, format: 'csv' | 'html' | 'pdf'): string {
  return apiResourceUrl(`/api/v1/matches/${id}/export`, { format });
}

export const MATCH_STATUS_LABELS_NL: Readonly<Record<MatchStatus, string>> = {
  new: 'Nieuw',
  under_review: 'Actief',
  confirmed_conflict: 'Actief',
  dismissed: 'Niet relevant',
  opposition_filed: 'Oppositie ingediend',
  opposition_deadline_passed: 'Termijn verstreken',
};

export const MATCH_QUEUE_LABELS_NL: Readonly<Record<MatchQueue, string>> = {
  possible: 'Mogelijke matches',
  active: 'Actieve matches',
  archived: 'Matcharchief',
};

export { ARCHIVED_MATCH_STATUSES, ACTIVE_MATCH_STATUSES, POSSIBLE_MATCH_STATUSES } from '@merkwacht/domain';
export type { MatchQueue } from '@merkwacht/domain';
