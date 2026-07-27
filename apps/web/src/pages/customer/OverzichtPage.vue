<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import DeadlineIndicator from '../../components/DeadlineIndicator.vue';
import DisclaimerBanner from '../../components/DisclaimerBanner.vue';
import KpiCard from '../../components/KpiCard.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { useDeadlines } from '../../api/deadlines';
import { MATCH_STATUS_LABELS_NL, useMatches } from '../../api/matches';
import { useNotifications } from '../../api/notifications';
import { WATCHED_TRADEMARK_STATUS_LABELS_NL, useWatchedTrademarks } from '../../api/watched-trademarks';
import { formatDate, formatNiceClasses } from '../../lib/format';
import { priorityFromScore } from '../../lib/priority';
import type { TrademarkMatchRecord } from '../../api/types';

const router = useRouter();

const watchedTrademarksQuery = useWatchedTrademarks();
const matchesQuery = useMatches();
const deadlinesQuery = useDeadlines();
const notificationsQuery = useNotifications();

const watchedTrademarks = computed(() => watchedTrademarksQuery.data.value ?? []);
const matches = computed(() => matchesQuery.data.value ?? []);
const deadlines = computed(() => deadlinesQuery.data.value ?? []);
const isLoadingLists = computed(
  () => watchedTrademarksQuery.isLoading.value || matchesQuery.isLoading.value || deadlinesQuery.isLoading.value,
);

const activeWatches = computed(
  () => watchedTrademarks.value.filter((w) => w.status === 'active' && w.eligibility.eligible).length,
);
const pendingActivation = computed(
  () => watchedTrademarks.value.filter((w) => w.status === 'active' && !w.eligibility.eligible).length,
);
const newMatches = computed(() => matches.value.filter((m) => m.status === 'new').length);
const highPriority = computed(
  () => matches.value.filter((m) => priorityFromScore(m.totalScore).level === 'high').length,
);
const deadlinesSoon = computed(
  () => deadlines.value.filter((d) => d.daysRemaining !== null && d.daysRemaining >= 0 && d.daysRemaining <= 14).length,
);
const unreadNotifications = computed(() => notificationsQuery.data.value?.length ?? 0);

const topMatches = computed(() =>
  [...matches.value].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5),
);
const upcomingDeadlines = computed(() => deadlines.value.slice(0, 5));

const matchColumns: readonly DataTableColumn<TrademarkMatchRecord>[] = [
  { key: 'priority', label: 'Prioriteit', width: '9rem' },
  { key: 'candidate', label: 'Kandidaat-aanvraag' },
  { key: 'watched', label: 'Bewaakt merk' },
  { key: 'score', label: 'Score', align: 'right', width: '6rem' },
  { key: 'status', label: 'Status', width: '9rem' },
];

function goToMatch(match: TrademarkMatchRecord): void {
  void router.push({ name: 'app-match-detail', params: { id: match.id } });
}
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Overzicht"
      description="Een samenvatting van bewaakte merken, nieuwe treffers en openstaande deadlines."
    />

    <section class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      <KpiCard label="Actieve bewakingen" :value="activeWatches" :loading="isLoadingLists" />
      <KpiCard label="Wacht op activatie" :value="pendingActivation" :loading="isLoadingLists" />
      <KpiCard label="Nieuwe matches" :value="newMatches" :loading="isLoadingLists" tone="warning" />
      <KpiCard label="Hoge prioriteit" :value="highPriority" :loading="isLoadingLists" tone="danger" />
      <KpiCard label="Deadlines binnen 14 dagen" :value="deadlinesSoon" :loading="isLoadingLists" tone="warning" />
      <KpiCard
        label="Ongelezen meldingen"
        :value="unreadNotifications"
        :loading="notificationsQuery.isLoading.value"
      />
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-text">Belangrijkste matches</h2>
        <RouterLink :to="{ name: 'app-matches' }" class="text-xs font-medium text-accent-strong hover:underline"
          >Alle matches</RouterLink
        >
      </div>
      <DisclaimerBanner compact />
      <DataTable
        :columns="matchColumns"
        :rows="topMatches"
        :row-key="(row) => row.id"
        :loading="matchesQuery.isLoading.value"
        clickable-rows
        empty-title="Nog geen matches"
        empty-description="Zodra nieuwe registerpublicaties worden vergeleken met uw bewaakte merken, verschijnen ze hier."
        @row-click="goToMatch"
      >
        <template #cell-priority="{ row }">
          <StatusBadge :label="priorityFromScore(row.totalScore).labelNl" :tone="priorityFromScore(row.totalScore).tone" />
        </template>
        <template #cell-candidate="{ row }">
          <span class="font-medium">{{ row.candidate.markText }}</span>
          <span class="ml-1 text-xs text-text-muted">({{ row.candidate.registryCode }})</span>
        </template>
        <template #cell-watched="{ row }">{{ row.watchedTrademarkLabel }}</template>
        <template #cell-score="{ row }">{{ row.totalScore }}</template>
        <template #cell-status="{ row }">
          <StatusBadge :label="MATCH_STATUS_LABELS_NL[row.status]" tone="neutral" />
        </template>
      </DataTable>
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section class="space-y-3">
        <h2 class="text-sm font-semibold text-text">Naderende oppositietermijnen</h2>
        <div class="rounded-lg border border-border bg-surface">
          <ul v-if="upcomingDeadlines.length > 0" class="divide-y divide-border">
            <li v-for="entry in upcomingDeadlines" :key="entry.matchId">
              <RouterLink
                :to="{ name: 'app-match-detail', params: { id: entry.matchId } }"
                class="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-muted/50"
              >
                <div class="min-w-0">
                  <p class="truncate font-medium text-text">{{ entry.candidateMarkText }}</p>
                  <p class="truncate text-xs text-text-muted">vs. {{ entry.watchedTrademarkLabel }}</p>
                </div>
                <DeadlineIndicator :days-remaining="entry.daysRemaining" />
              </RouterLink>
            </li>
          </ul>
          <p v-else class="px-4 py-8 text-center text-sm text-text-muted">Geen openstaande deadlines.</p>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-sm font-semibold text-text">Status bewaakte merken</h2>
        <div class="rounded-lg border border-border bg-surface">
          <ul v-if="watchedTrademarks.length > 0" class="divide-y divide-border">
            <li v-for="watched in watchedTrademarks" :key="watched.id">
              <RouterLink
                :to="{ name: 'app-watched-trademark-detail', params: { id: watched.id } }"
                class="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-muted/50"
              >
                <div class="min-w-0">
                  <p class="truncate font-medium text-text">{{ watched.label }}</p>
                  <p class="truncate text-xs text-text-muted">
                    {{ watched.markText }} · klassen {{ formatNiceClasses(watched.niceClasses) }}
                  </p>
                </div>
                <StatusBadge
                  :label="WATCHED_TRADEMARK_STATUS_LABELS_NL[watched.status]"
                  :tone="watched.status === 'active' ? 'success' : 'neutral'"
                />
              </RouterLink>
            </li>
          </ul>
          <p v-else class="px-4 py-8 text-center text-sm text-text-muted">Nog geen merken toegevoegd.</p>
        </div>
      </section>
    </div>

    <p v-if="watchedTrademarksQuery.isError.value || matchesQuery.isError.value" class="text-xs text-danger">
      Niet alle gegevens konden worden geladen op {{ formatDate(new Date().toISOString()) }}. Ververs de pagina om
      het opnieuw te proberen.
    </p>
  </div>
</template>
