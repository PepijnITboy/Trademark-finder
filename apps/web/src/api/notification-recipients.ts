import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type {
  CreateNotificationRecipientInput,
  NotificationRecipientRecord,
  UpdateNotificationRecipientInput,
} from './types';

async function fetchNotificationRecipients(): Promise<readonly NotificationRecipientRecord[]> {
  const { recipients } = await apiRequest<{ recipients: readonly NotificationRecipientRecord[] }>(
    '/api/v1/notification-recipients',
  );
  return recipients;
}

export function useNotificationRecipients() {
  return useQuery({ queryKey: queryKeys.notificationRecipients, queryFn: fetchNotificationRecipients });
}

export function useCreateNotificationRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNotificationRecipientInput) =>
      apiRequest<{ recipient: NotificationRecipientRecord }>('/api/v1/notification-recipients', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationRecipients });
    },
  });
}

export function useUpdateNotificationRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateNotificationRecipientInput }) =>
      apiRequest<{ recipient: NotificationRecipientRecord }>(`/api/v1/notification-recipients/${id}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationRecipients });
    },
  });
}

export function useDeleteNotificationRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/v1/notification-recipients/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationRecipients });
    },
  });
}
