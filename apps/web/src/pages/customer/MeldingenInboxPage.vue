<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import MwSelect from '../../components/MwSelect.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { apiRequest } from '../../api/client';
import { queryKeys } from '../../api/keys';
import type { InAppNotificationRecord } from '../../api/types';
import { formatDateTime } from '../../lib/format';

const KIND_OPTIONS = [
  { value: 'all', label: 'Alle soorten' },
  { value: 'match', label: 'Matches' },
  { value: 'admin', label: 'Beheer' },
  { value: 'report_ready', label: 'Rapport klaar' },
  { value: 'connector_down', label: 'Connector offline' },
  { value: 'invoice', label: 'Facturen' },
  { value: 'general', label: 'Overig' },
];

const KIND_LABELS: Record<string, string> = Object.fromEntries(
  KIND_OPTIONS.filter((o) => o.value !== 'all').map((o) => [o.value, o.label]),
);

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const kindFilter = ref(String(route.query.kind ?? 'all'));

const notificationsQuery = useQuery({
  queryKey: queryKeys.inAppNotifications,
  queryFn: async () => {
    const result = await apiRequest<{
      inAppNotifications: readonly InAppNotificationRecord[];
      unreadCount: number;
    }>('/api/v1/notifications');
    return result;
  },
});

const items = computed(() => {
  const all = notificationsQuery.data.value?.inAppNotifications ?? [];
  if (kindFilter.value === 'all') return all;
  return all.filter((n) => (n.kind ?? 'general') === kindFilter.value);
});

const highlightId = computed(() => String(route.query.id ?? ''));

const markRead = useMutation({
  mutationFn: (id: string) => apiRequest(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.inAppNotifications });
  },
});

function onSelect(item: InAppNotificationRecord): void {
  if (!item.readAt) markRead.mutate(item.id);
  void router.replace({ query: { ...route.query, id: item.id } });
}

function onKindChange(value: string): void {
  kindFilter.value = value;
  void router.replace({ query: { ...route.query, kind: value === 'all' ? undefined : value } });
}

const WHY_COPY: Record<string, string> = {
  match: 'Waarom: een match scoorde boven uw meldingsdrempel.',
  connector_down: 'Waarom: een register is uitgeschakeld of de verbinding werkt niet — bewaking is tijdelijk gestopt.',
  report_ready: 'Waarom: uw merkonderzoek-rapport is klaar om te downloaden.',
  invoice: 'Waarom: er is een factuur- of betalingsupdate voor uw organisatie.',
  admin: 'Waarom: een beheerder van Merkwacht stuurde een bericht.',
  general: 'Waarom: algemene melding voor uw organisatie.',
};

function whyCopy(kind: string | undefined): string {
  return WHY_COPY[kind ?? 'general'] ?? WHY_COPY.general!;
}
</script>

<template>
  <MwPage
    title="Meldingen"
    description="Volledige inbox: matches, beheerberichten, rapporten, connectorstatus en facturen."
  >
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <MwSelect
        id="kind-filter"
        :model-value="kindFilter"
        :options="KIND_OPTIONS"
        @update:model-value="onKindChange"
      />
      <p class="text-xs text-text-muted">
        Ongelezen: {{ notificationsQuery.data.value?.unreadCount ?? 0 }}
      </p>
    </div>

    <MwBanner v-if="notificationsQuery.isError.value" tone="danger" title="Meldingen konden niet worden geladen" />

    <MwCard v-else title="Inbox">
      <ul v-if="items.length" class="divide-y divide-border">
        <li
          v-for="item in items"
          :key="item.id"
          class="cursor-pointer px-1 py-3 hover:bg-surface-muted/40"
          :class="{
            'bg-accent-soft/20': !item.readAt,
            'ring-1 ring-accent': highlightId === item.id,
          }"
          @click="onSelect(item)"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-medium text-text">{{ item.title }}</p>
              <p class="mt-0.5 text-sm text-text-muted">{{ item.body }}</p>
              <p class="mt-1 text-xs text-accent-strong/90">{{ whyCopy(item.kind) }}</p>
              <p class="mt-1 text-xs text-text-muted">{{ formatDateTime(item.createdAt) }}</p>
            </div>
            <StatusBadge :label="KIND_LABELS[item.kind ?? 'general'] ?? 'Overig'" tone="neutral" />
          </div>
        </li>
      </ul>
      <p v-else class="text-sm text-text-muted">Geen meldingen in deze filter.</p>
    </MwCard>
  </MwPage>
</template>
