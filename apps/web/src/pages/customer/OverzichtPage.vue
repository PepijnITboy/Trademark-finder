<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import DeadlineIndicator from '../../components/DeadlineIndicator.vue';
import DisclaimerBanner from '../../components/DisclaimerBanner.vue';
import KpiCard from '../../components/KpiCard.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwCard from '../../components/MwCard.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { useDeadlines } from '../../api/deadlines';
import { MATCH_STATUS_LABELS_NL, useMatches } from '../../api/matches';
import { useNameResearchOrders } from '../../api/name-research';
import { useNotifications } from '../../api/notifications';
import { WATCHED_TRADEMARK_STATUS_LABELS_NL, useWatchedTrademarks } from '../../api/watched-trademarks';
import { resolveProtectionDisplay } from '@merkwacht/domain';
import { formatDate, formatMatchScorePercent, formatNiceClasses } from '../../lib/format';
import { priorityFromScore } from '../../lib/priority';
import type { TrademarkMatchRecord } from '../../api/types';

const router = useRouter();

const watchedTrademarksQuery = useWatchedTrademarks();
const possibleMatchesQuery = useMatches({ queue: 'possible' });
const activeMatchesQuery = useMatches({ queue: 'active' });
const deadlinesQuery = useDeadlines();
const notificationsQuery = useNotifications();
const researchOrdersQuery = useNameResearchOrders();

const watchedTrademarks = computed(() => watchedTrademarksQuery.data.value ?? []);
const possibleMatches = computed(() => possibleMatchesQuery.data.value ?? []);
const activeMatches = computed(() => activeMatchesQuery.data.value ?? []);
const deadlines = computed(() => deadlinesQuery.data.value ?? []);
const isLoadingLists = computed(
  () =>
    watchedTrademarksQuery.isLoading.value ||
    possibleMatchesQuery.isLoading.value ||
    activeMatchesQuery.isLoading.value ||
    deadlinesQuery.isLoading.value,
);

const activeWatches = computed(
  () =>
    watchedTrademarks.value.filter((w) =>
      resolveProtectionDisplay({
        status: w.status,
        eligibility: w.eligibility,
        registerMonitoringOk: w.registerMonitoringOk ?? false,
      }).activelyProtected,
    ).length,
);
const pendingActivation = computed(
  () =>
    watchedTrademarks.value.filter(
      (w) =>
        w.status === 'active' &&
        !resolveProtectionDisplay({
          status: w.status,
          eligibility: w.eligibility,
          registerMonitoringOk: w.registerMonitoringOk ?? false,
        }).activelyProtected,
    ).length,
);
const newMatches = computed(() => possibleMatches.value.filter((m) => m.status === 'new').length);
const highPriority = computed(
  () => activeMatches.value.filter((m) => priorityFromScore(m.totalScore).level === 'high').length,
);
const deadlinesSoon = computed(
  () => deadlines.value.filter((d) => d.daysRemaining !== null && d.daysRemaining >= 0 && d.daysRemaining <= 14).length,
);
const unreadNotifications = computed(() => notificationsQuery.data.value?.length ?? 0);

const topMatches = computed(() =>
  [...activeMatches.value].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5),
);
const matchColumns: readonly DataTableColumn<TrademarkMatchRecord>[] = [
  { key: 'priority', label: 'Prioriteit', width: '9rem' },
  { key: 'watched', label: 'Eigen merk' },
  { key: 'candidate', label: 'Match gevonden' },
  { key: 'score', label: 'Score', align: 'right', width: '6rem' },
  { key: 'status', label: 'Status', width: '9rem' },
];

const upcomingDeadlinesOnly = computed(() =>
  deadlines.value.filter((d) => d.daysRemaining !== null && d.daysRemaining >= 0).slice(0, 5),
);

const recentResearch = computed(() => (researchOrdersQuery.data.value ?? []).slice(0, 5));

function goToMatch(match: TrademarkMatchRecord): void {
  void router.push({ name: 'app-match-detail', params: { id: match.id } });
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Dashboard"
      description="Een samenvatting van bewaakte merken, nieuwe treffers en openstaande deadlines."
    />

    <MwBanner v-if="watchedTrademarksQuery.isError.value || possibleMatchesQuery.isError.value || activeMatchesQuery.isError.value" tone="danger" title="Niet alle gegevens konden worden geladen">
      Probeer de pagina te verversen. Laatste poging: {{ formatDate(new Date().toISOString()) }}.
    </MwBanner>

    <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
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

    <MwCard title="Belangrijkste matches" :padding="false">
      <template #actions>
        <RouterLink :to="{ name: 'app-matches' }" class="text-sm font-medium text-accent-strong hover:underline">
          Actieve matches
        </RouterLink>
      </template>
      <div class="border-b border-border px-5 py-3">
        <DisclaimerBanner compact />
      </div>
      <DataTable
        embedded
        :columns="matchColumns"
        :rows="topMatches"
        :row-key="(row) => row.id"
        :loading="activeMatchesQuery.isLoading.value"
        clickable-rows
        empty-title="Nog geen matches"
        empty-description="Zodra nieuwe registerpublicaties worden vergeleken met uw bewaakte merken, verschijnen ze hier."
        @row-click="goToMatch"
      >
        <template #cell-priority="{ row }">
          <StatusBadge :label="priorityFromScore(row.totalScore).labelNl" :tone="priorityFromScore(row.totalScore).tone" />
        </template>
        <template #cell-watched="{ row }">{{ row.watchedTrademarkLabel }}</template>
        <template #cell-candidate="{ row }">
          <span class="font-medium">{{ row.candidate.markText }}</span>
          <span class="ml-1 text-xs text-text-muted">({{ row.candidate.registryCode }})</span>
        </template>
        <template #cell-score="{ row }">{{ formatMatchScorePercent(row.totalScore) }}</template>
        <template #cell-status="{ row }">
          <StatusBadge :label="MATCH_STATUS_LABELS_NL[row.status]" tone="neutral" />
        </template>
      </DataTable>
    </MwCard>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <MwCard title="Verlopende oppositietermijnen" :padding="false">
        <ul v-if="upcomingDeadlinesOnly.length > 0" class="divide-y divide-border">
          <li v-for="entry in upcomingDeadlinesOnly" :key="entry.matchId">
            <RouterLink
              :to="{ name: 'app-match-detail', params: { id: entry.matchId } }"
              class="flex items-center justify-between gap-3 px-5 py-3.5 text-sm hover:bg-surface-muted/50"
            >
              <div class="min-w-0">
                <p class="truncate font-medium text-text">{{ entry.candidateMarkText }}</p>
                <p class="truncate text-xs text-text-muted">vs. {{ entry.watchedTrademarkLabel }}</p>
              </div>
              <DeadlineIndicator
                :days-remaining="entry.daysRemaining"
                :deadline-date="entry.deadline?.deadlineDate"
              />
            </RouterLink>
          </li>
        </ul>
        <p v-else class="px-5 py-10 text-center text-sm text-text-muted">Geen openstaande deadlines.</p>
      </MwCard>

      <MwCard title="Status bewaakte merken" :padding="false">
        <ul v-if="watchedTrademarks.length > 0" class="divide-y divide-border">
          <li v-for="watched in watchedTrademarks" :key="watched.id">
            <RouterLink
              :to="{ name: 'app-watched-trademark-detail', params: { id: watched.id } }"
              class="flex items-center justify-between gap-3 px-5 py-3.5 text-sm hover:bg-surface-muted/50"
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
        <p v-else class="px-5 py-10 text-center text-sm text-text-muted">Nog geen merken toegevoegd.</p>
      </MwCard>
    </div>

    <MwCard title="Recente merkonderzoeken" :padding="false">
      <template #actions>
        <RouterLink
          :to="{ name: 'app-merkonderzoek' }"
          class="text-sm font-medium text-accent-strong hover:underline"
        >
          Alle rapporten
        </RouterLink>
      </template>
      <ul v-if="recentResearch.length > 0" class="divide-y divide-border">
        <li v-for="order in recentResearch" :key="order.id">
          <RouterLink
            :to="{ name: 'app-merkonderzoek-detail', params: { id: order.id } }"
            class="flex items-center justify-between gap-3 px-5 py-3.5 text-sm hover:bg-surface-muted/50"
          >
            <div class="min-w-0">
              <p class="truncate font-medium text-text">{{ order.markText }}</p>
              <p class="truncate text-xs text-text-muted">
                {{ order.scopes.map((s) => s.registryCode).join(', ') }} · {{ order.status }}
              </p>
            </div>
            <span v-if="order.overallRiskScore != null" class="tabular-nums text-text-muted">
              {{ Math.round(order.overallRiskScore) }}%
            </span>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="px-5 py-10 text-center text-sm text-text-muted">
        Nog geen merkonderzoeken.
        <RouterLink :to="{ name: 'app-merkonderzoek-nieuw' }" class="text-accent-strong hover:underline">
          Start een aanvraag
        </RouterLink>
      </p>
    </MwCard>
  </div>
</template>
