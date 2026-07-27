<script setup lang="ts">
import { useRouter } from 'vue-router';
import DataTable, { type DataTableColumn } from '../../../components/DataTable.vue';
import StatusBadge from '../../../components/StatusBadge.vue';
import { MATCH_STATUS_LABELS_NL } from '../../../api/matches';
import { formatDate, formatNiceClasses } from '../../../lib/format';
import { priorityFromScore } from '../../../lib/priority';
import type { TrademarkMatchRecord } from '../../../api/types';

defineProps<{ matches: readonly TrademarkMatchRecord[]; loading: boolean }>();
const router = useRouter();

const columns: readonly DataTableColumn<TrademarkMatchRecord>[] = [
  { key: 'priority', label: 'Prioriteit', width: '8rem' },
  { key: 'candidate', label: 'Kandidaat-aanvraag' },
  { key: 'niceClasses', label: 'Klassen', width: '9rem' },
  { key: 'deadline', label: 'Termijn', width: '9rem' },
  { key: 'status', label: 'Status', width: '10rem' },
];

function goToMatch(match: TrademarkMatchRecord): void {
  void router.push({ name: 'app-match-detail', params: { id: match.id } });
}
</script>

<template>
  <DataTable
    :columns="columns"
    :rows="matches"
    :row-key="(row) => row.id"
    :loading="loading"
    clickable-rows
    empty-title="Geen matches voor dit merk"
    empty-description="Zodra een nieuwe registerpublicatie voldoende overeenkomt, verschijnt deze hier."
    @row-click="goToMatch"
  >
    <template #cell-priority="{ row }">
      <StatusBadge :label="priorityFromScore(row.totalScore).labelNl" :tone="priorityFromScore(row.totalScore).tone" />
    </template>
    <template #cell-candidate="{ row }">
      <span class="font-medium">{{ row.candidate.markText }}</span>
      <span class="ml-1 text-xs text-text-muted">({{ row.candidate.registryCode }})</span>
    </template>
    <template #cell-niceClasses="{ row }">{{ formatNiceClasses(row.candidate.niceClasses) }}</template>
    <template #cell-deadline="{ row }">{{ formatDate(row.candidate.oppositionDeadline?.deadlineDate) }}</template>
    <template #cell-status="{ row }">
      <StatusBadge :label="MATCH_STATUS_LABELS_NL[row.status]" tone="neutral" />
    </template>
  </DataTable>
</template>
