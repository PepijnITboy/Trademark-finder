import { useQuery } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type { DeadlineEntry } from './types';

async function fetchDeadlines(): Promise<readonly DeadlineEntry[]> {
  const { deadlines } = await apiRequest<{ deadlines: readonly DeadlineEntry[] }>('/api/v1/deadlines');
  return deadlines;
}

export function useDeadlines() {
  return useQuery({ queryKey: queryKeys.deadlines, queryFn: fetchDeadlines });
}
