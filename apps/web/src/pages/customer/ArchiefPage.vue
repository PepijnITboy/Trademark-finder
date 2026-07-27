<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { useArchive } from '../../api/archive';
import {
  formatDate,
  formatDaysOverdue,
  formatMatchScorePercent,
  overdueSeverity,
} from '../../lib/format';
import type { TrademarkMatchRecord } from '../../api/types';

const router = useRouter();
const archiveQuery = useArchive();

const dismissed = computed(() =>
  (archiveQuery.data.value?.matches ?? []).filter((m) => m.status === 'dismissed'),
);
const expired = computed(() =>
  (archiveQuery.data.value?.matches ?? []).filter((m) => m.status === 'opposition_deadline_passed'),
);

const matchColumns: readonly DataTableColumn<TrademarkMatchRecord>[] = [
  { key: 'watched', label: 'Eigenmerk' },
  { key: 'candidate', label: 'Match gevonden' },
  { key: 'score', label: 'Score', align: 'right', width: '6rem' },
  { key: 'updatedAt', label: 'Afgehandeld op', width: '10rem' },
];

const expiredColumns: readonly DataTableColumn<TrademarkMatchRecord>[] = [
  { key: 'watched', label: 'Eigenmerk' },
  { key: 'candidate', label: 'Match gevonden' },
  { key: 'overdue', label: 'Verstreken', width: '12rem' },
  { key: 'score', label: 'Score', align: 'right', width: '6rem' },
];

function daysOverdue(match: TrademarkMatchRecord): number {
  const deadline = match.candidate.oppositionDeadline?.deadlineDate;
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((Date.now() - new Date(deadline).getTime()) / (1000 * 60 * 60 * 24)));
}

function severityTone(days: number): 'warning' | 'danger' | 'neutral' {
  const sev = overdueSeverity(days);
  if (sev === 'mild') return 'warning';
  if (sev === 'moderate') return 'danger';
  return 'danger';
}

function goToMatch(record: TrademarkMatchRecord): void {
  void router.push({ name: 'app-match-detail', params: { id: record.id } });
}
</script>

<template>
  <MwPage title="Matcharchief" description="Niet-relevante matches en verstreken oppositietermijnen.">
    <MwCard title="Niet-relevante matches" :padding="false">
      <DataTable
        embedded
        :columns="matchColumns"
        :rows="dismissed"
        :row-key="(row) => row.id"
        :loading="archiveQuery.isLoading.value"
        clickable-rows
        empty-title="Geen afgehandelde matches"
        empty-description="Matches die u als niet relevant markeert, verschijnen hier."
        @row-click="goToMatch"
      >
        <template #cell-watched="{ row }">{{ row.watchedTrademarkLabel }}</template>
        <template #cell-candidate="{ row }">
          <span class="font-medium">{{ row.candidate.markText }}</span>
          <StatusBadge label="Niet relevant" tone="neutral" class="ml-2" />
        </template>
        <template #cell-score="{ row }">{{ formatMatchScorePercent(row.totalScore) }}</template>
        <template #cell-updatedAt="{ row }">{{ formatDate(row.updatedAt) }}</template>
      </DataTable>
    </MwCard>

    <MwCard title="Verstreken oppositietermijn" :padding="false">
      <DataTable
        embedded
        :columns="expiredColumns"
        :rows="expired"
        :row-key="(row) => row.id"
        :loading="archiveQuery.isLoading.value"
        clickable-rows
        empty-title="Geen verstreken termijnen"
        empty-description="Matches waarvan de oppositietermijn is verstreken, verschijnen hier."
        @row-click="goToMatch"
      >
        <template #cell-watched="{ row }">{{ row.watchedTrademarkLabel }}</template>
        <template #cell-candidate="{ row }">
          <span class="font-medium">{{ row.candidate.markText }}</span>
        </template>
        <template #cell-overdue="{ row }">
          <StatusBadge
            :label="formatDaysOverdue(daysOverdue(row))"
            :tone="severityTone(daysOverdue(row))"
          />
        </template>
        <template #cell-score="{ row }">{{ formatMatchScorePercent(row.totalScore) }}</template>
      </DataTable>
    </MwCard>
  </MwPage>
</template>
