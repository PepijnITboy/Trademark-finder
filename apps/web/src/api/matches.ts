import type { MatchStatus } from '@merkwacht/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { apiRequest, apiResourceUrl } from './client';
import { queryKeys } from './keys';
import type { MatchNoteRecord, TrademarkMatchRecord } from './types';

async function fetchMatches(status?: MatchStatus): Promise<readonly TrademarkMatchRecord[]> {
  const { matches } = await apiRequest<{ matches: readonly TrademarkMatchRecord[] }>('/api/v1/matches', {
    query: { status },
  });
  return matches;
}

async function fetchMatch(id: string): Promise<TrademarkMatchRecord> {
  const { match } = await apiRequest<{ match: TrademarkMatchRecord }>(`/api/v1/matches/${id}`);
  return match;
}

export function useMatches(status?: MaybeRefOrGetter<MatchStatus | undefined>) {
  return useQuery({
    queryKey: queryKeys.matches.all(status ? toValue(status) : undefined),
    queryFn: () => fetchMatches(status ? toValue(status) : undefined),
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

export function matchExportUrl(id: string, format: 'csv' | 'html'): string {
  return apiResourceUrl(`/api/v1/matches/${id}/export`, { format });
}

export const MATCH_STATUS_LABELS_NL: Readonly<Record<MatchStatus, string>> = {
  new: 'Nieuw',
  under_review: 'In behandeling',
  confirmed_conflict: 'Relevant',
  dismissed: 'Niet relevant',
  opposition_filed: 'Oppositie ingediend',
  opposition_deadline_passed: 'Termijn verstreken',
};
