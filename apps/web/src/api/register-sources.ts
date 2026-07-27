import { useQuery } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type { RegisterSourceStatusRecord } from './types';

async function fetchRegisterSources(): Promise<readonly RegisterSourceStatusRecord[]> {
  const { sources } = await apiRequest<{ sources: readonly RegisterSourceStatusRecord[] }>(
    '/api/v1/register-sources',
  );
  return sources;
}

export function useRegisterSources() {
  return useQuery({ queryKey: queryKeys.registerSources, queryFn: fetchRegisterSources });
}
