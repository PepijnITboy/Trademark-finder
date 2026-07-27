<script setup lang="ts">
import type { MatchStatus } from '@merkwacht/domain';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { MATCH_STATUS_LABELS_NL, useMatches } from '../../api/matches';
import { formatDate, formatNiceClasses, formatPercentage } from '../../lib/format';
import { priorityFromScore, type PriorityLevel } from '../../lib/priority';
import type { TrademarkMatchRecord } from '../../api/types';

const router = useRouter();
const matchesQuery = useMatches();

const statusFilter = ref<MatchStatus | 'all'>('all');
const priorityFilter = ref<PriorityLevel | 'all'>('all');
const searchTerm = ref('');

const filteredMatches = computed(() => {
  const all = matchesQuery.data.value ?? [];
  return all.filter((match) => {
    if (statusFilter.value !== 'all' && match.status !== statusFilter.value) return false;
    if (priorityFilter.value !== 'all' && priorityFromScore(match.totalScore).level !== priorityFilter.value) return false;
    if (searchTerm.value.trim().length > 0) {
      const term = searchTerm.value.trim().toLowerCase();
      const haystack = `${match.candidate.markText} ${match.watchedTrademarkLabel}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
});

const columns: readonly DataTableColumn<TrademarkMatchRecord>[] = [
  { key: 'priority', label: 'Prioriteit', width: '8rem' },
  { key: 'candidate', label: 'Kandidaat-aanvraag' },
  { key: 'watched', label: 'Bewaakt merk' },
  { key: 'phonetic', label: 'Fonetisch', align: 'right', width: '7rem' },
  { key: 'niceClasses', label: 'Klassen', width: '8rem' },
  { key: 'deadline', label: 'Termijn', width: '9rem' },
  { key: 'status', label: 'Status', width: '10rem' },
];

function goToMatch(match: TrademarkMatchRecord): void {
  void router.push({ name: 'app-match-detail', params: { id: match.id } });
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Matches" description="Beoordeel nieuw gesignaleerde en eerder behandelde merkconflicten." />

    <div class="flex flex-wrap items-center gap-3">
      <input
        v-model="searchTerm"
        type="search"
        placeholder="Zoek op merknaam…"
        class="w-56 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
      <select
        v-model="statusFilter"
        class="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <option value="all">Alle statussen</option>
        <option v-for="(labelNl, value) in MATCH_STATUS_LABELS_NL" :key="value" :value="value">{{ labelNl }}</option>
      </select>
      <select
        v-model="priorityFilter"
        class="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <option value="all">Alle prioriteiten</option>
        <option value="high">Hoog</option>
        <option value="medium">Gemiddeld</option>
        <option value="low">Laag</option>
      </select>
      <p class="ml-auto text-xs text-text-muted">{{ filteredMatches.length }} van {{ matchesQuery.data.value?.length ?? 0 }}</p>
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredMatches"
      :row-key="(row) => row.id"
      :loading="matchesQuery.isLoading.value"
      clickable-rows
      empty-title="Geen matches gevonden"
      empty-description="Pas de filters aan of wacht tot nieuwe registerpublicaties zijn verwerkt."
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
      <template #cell-phonetic="{ row }">{{ formatPercentage(row.scores.phoneticSimilarity) }}</template>
      <template #cell-niceClasses="{ row }">{{ formatNiceClasses(row.candidate.niceClasses) }}</template>
      <template #cell-deadline="{ row }">{{ formatDate(row.candidate.oppositionDeadline?.deadlineDate) }}</template>
      <template #cell-status="{ row }">
        <StatusBadge :label="MATCH_STATUS_LABELS_NL[row.status]" tone="neutral" />
      </template>
    </DataTable>
  </div>
</template>
