import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type { OrganizationSettingsRecord, UpdateOrganizationSettingsInput } from './types';

async function fetchSettings(): Promise<OrganizationSettingsRecord> {
  const { settings } = await apiRequest<{ settings: OrganizationSettingsRecord }>('/api/v1/settings');
  return settings;
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: fetchSettings });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateOrganizationSettingsInput) =>
      apiRequest<{ settings: OrganizationSettingsRecord }>('/api/v1/settings', {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}
