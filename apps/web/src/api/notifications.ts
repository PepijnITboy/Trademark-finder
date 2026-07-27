import { useQuery } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type { NotificationRecord } from './types';

async function fetchNotifications(): Promise<readonly NotificationRecord[]> {
  const { notifications } = await apiRequest<{ notifications: readonly NotificationRecord[] }>(
    '/api/v1/notifications',
  );
  return notifications;
}

export function useNotifications() {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: fetchNotifications });
}
