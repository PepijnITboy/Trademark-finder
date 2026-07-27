import { useQuery } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type { ArchiveResponse } from './types';

async function fetchArchive(): Promise<ArchiveResponse> {
  return apiRequest<ArchiveResponse>('/api/v1/archive');
}

export function useArchive() {
  return useQuery({ queryKey: queryKeys.archive, queryFn: fetchArchive });
}
