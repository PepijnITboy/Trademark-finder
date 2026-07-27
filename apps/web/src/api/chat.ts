import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { type MaybeRefOrGetter, toValue } from 'vue';
import { apiRequest } from './client';
import { queryKeys } from './keys';
import type { ChatThreadDetail, SupportMessageRecord, SupportThreadRecord } from './types';

async function fetchChatThreads(): Promise<readonly SupportThreadRecord[]> {
  const { threads } = await apiRequest<{ threads: readonly SupportThreadRecord[] }>('/api/v1/chat/threads');
  return threads;
}

async function fetchChatThread(id: string): Promise<ChatThreadDetail> {
  return apiRequest<ChatThreadDetail>(`/api/v1/chat/threads/${id}`);
}

export function useChatThreads() {
  return useQuery({ queryKey: queryKeys.chat.threads, queryFn: fetchChatThreads });
}

export function useChatThread(id: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.chat.thread(toValue(id) ?? ''),
    queryFn: () => fetchChatThread(toValue(id)!),
    enabled: () => Boolean(toValue(id)),
  });
}

export interface CreateChatThreadInput {
  readonly subject: string;
  readonly body: string;
  readonly trademarkMatchId?: string;
}

export function useCreateChatThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChatThreadInput) =>
      apiRequest<{ thread: SupportThreadRecord; message: SupportMessageRecord }>('/api/v1/chat/threads', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads });
    },
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, body }: { threadId: string; body: string }) =>
      apiRequest<{ message: SupportMessageRecord }>(`/api/v1/chat/threads/${threadId}/messages`, {
        method: 'POST',
        body: { body },
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.thread(variables.threadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads });
    },
  });
}
