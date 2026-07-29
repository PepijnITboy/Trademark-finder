<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { apiRequest } from '../../api/client';
import { queryKeys } from '../../api/keys';
import type { InAppNotificationRecord } from '../../api/types';
import { formatDateTime } from '../../lib/format';

const open = ref(false);
const queryClient = useQueryClient();
const router = useRouter();

const notificationsQuery = useQuery({
  queryKey: queryKeys.inAppNotifications,
  queryFn: async () => {
    const result = await apiRequest<{
      inAppNotifications: readonly InAppNotificationRecord[];
      unreadCount: number;
    }>('/api/v1/notifications');
    return result;
  },
  refetchInterval: 30_000,
});

const unread = computed(() => notificationsQuery.data.value?.unreadCount ?? 0);
const items = computed(() => (notificationsQuery.data.value?.inAppNotifications ?? []).slice(0, 8));

const markRead = useMutation({
  mutationFn: (id: string) => apiRequest(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inAppNotifications });
  },
});

function toggle(): void {
  open.value = !open.value;
}

function onSelect(item: InAppNotificationRecord): void {
  if (!item.readAt) markRead.mutate(item.id);
  open.value = false;
  void router.push({ name: 'app-meldingen', query: { id: item.id, kind: item.kind } });
}

function goInbox(): void {
  open.value = false;
  void router.push({ name: 'app-meldingen' });
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label="Meldingen"
      :aria-expanded="open"
      @click="toggle"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      <span
        v-if="unread > 0"
        class="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
      >
        {{ unread > 9 ? '9+' : unread }}
      </span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      role="dialog"
      aria-label="In-app meldingen"
    >
      <div class="flex items-center justify-between border-b border-border px-3 py-2">
        <span class="text-sm font-semibold text-text">Meldingen</span>
        <button type="button" class="text-xs font-medium text-accent hover:underline" @click="goInbox">
          Alle meldingen
        </button>
      </div>
      <ul v-if="items.length" class="max-h-80 divide-y divide-border overflow-y-auto">
        <li v-for="item in items" :key="item.id">
          <button
            type="button"
            class="w-full px-3 py-2.5 text-left hover:bg-surface-muted/60"
            :class="!item.readAt && 'bg-accent-soft/20'"
            @click="onSelect(item)"
          >
            <p class="text-sm font-medium text-text">{{ item.title }}</p>
            <p class="mt-0.5 line-clamp-2 text-xs text-text-muted">{{ item.body }}</p>
            <p class="mt-1 text-[11px] text-text-muted">{{ formatDateTime(item.createdAt) }}</p>
          </button>
        </li>
      </ul>
      <p v-else class="px-3 py-6 text-center text-sm text-text-muted">Geen meldingen</p>
    </div>
  </div>
</template>
