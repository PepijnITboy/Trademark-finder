import { useQuery } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type { DashboardResponse } from './types';

async function fetchDashboard(): Promise<DashboardResponse> {
  return apiRequest<DashboardResponse>('/api/v1/dashboard');
}

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: fetchDashboard });
}
