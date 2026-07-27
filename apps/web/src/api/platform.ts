import { useQuery } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type { PlatformHealthResponse } from './types';

async function fetchPlatformHealth(): Promise<PlatformHealthResponse> {
  return apiRequest<PlatformHealthResponse>('/api/platform/health');
}

export function usePlatformHealth() {
  return useQuery({ queryKey: queryKeys.platformHealth, queryFn: fetchPlatformHealth, retry: 1 });
}
