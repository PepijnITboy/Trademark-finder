<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ARCHIVED_MATCH_STATUSES, MATCH_STATUS_LABELS_NL } from '../../../api/matches';
import DataTable, { type DataTableColumn } from '../../../components/DataTable.vue';
import DeadlineIndicator from '../../../components/DeadlineIndicator.vue';
import StatusBadge from '../../../components/StatusBadge.vue';
import type { TrademarkMatchRecord } from '../../../api/types';
import { formatNiceClasses } from '../../../lib/format';

const props = defineProps<{
  matches: readonly TrademarkMatchRecord[];
  loading?: boolean;
}>();

const router = useRouter();

const archived = computed(() =>
  props.matches.filter((m) => (ARCHIVED_MATCH_STATUSES as readonly string[]).includes(m.status)),
);

const columns: readonly DataTableColumn<TrademarkMatchRecord>[] = [
  { key: 'candidate', label: 'Kandidaat-aanvraag' },
  { key: 'status', label: 'Status', width: '9rem' },
  { key: 'niceClasses', label: 'Klassen', width: '8rem' },
  { key: 'score', label: 'Score', align: 'right', width: '5rem' },
  { key: 'deadline', label: 'Termijn', width: '8rem' },
];

function daysRemaining(match: TrademarkMatchRecord): number | null {
  const d = match.candidate.oppositionDeadline?.deadlineDate;
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function goTo(match: TrademarkMatchRecord): void {
  void router.push({ name: 'app-match-detail', params: { id: match.id } });
}
</script>

<template>
  <DataTable
    :columns="columns"
    :rows="archived"
    :row-key="(row) => row.id"
    :loading="loading"
    clickable-rows
    empty-title="Geen gearchiveerde matches voor dit merk"
    empty-description="Afgewezen of verlopen matches verschijnen hier."
    @row-click="goTo"
  >
    <template #cell-candidate="{ row }">
      <span class="font-medium">{{ row.candidate.markText }}</span>
    </template>
    <template #cell-status="{ row }">
      <StatusBadge :label="MATCH_STATUS_LABELS_NL[row.status]" tone="neutral" />
    </template>
    <template #cell-niceClasses="{ row }">{{ formatNiceClasses(row.candidate.niceClasses) }}</template>
    <template #cell-score="{ row }">{{ row.totalScore }}</template>
    <template #cell-deadline="{ row }">
      <DeadlineIndicator :days-remaining="daysRemaining(row)" />
    </template>
  </DataTable>
</template>
