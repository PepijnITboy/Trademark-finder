<script setup lang="ts">
import { useRouter } from 'vue-router';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { useArchive } from '../../api/archive';
import { formatDate, formatNiceClasses } from '../../lib/format';
import type { TrademarkMatchRecord, WatchedTrademarkRecord } from '../../api/types';

const router = useRouter();
const archiveQuery = useArchive();

const watchedColumns: readonly DataTableColumn<WatchedTrademarkRecord>[] = [
  { key: 'label', label: 'Merk' },
  { key: 'registryCode', label: 'Register', width: '8rem' },
  { key: 'niceClasses', label: 'Nice-klassen', width: '10rem' },
  { key: 'updatedAt', label: 'Gearchiveerd op', width: '10rem' },
];

const matchColumns: readonly DataTableColumn<TrademarkMatchRecord>[] = [
  { key: 'candidate', label: 'Kandidaat-aanvraag' },
  { key: 'watched', label: 'Bewaakt merk' },
  { key: 'score', label: 'Score', align: 'right', width: '6rem' },
  { key: 'updatedAt', label: 'Afgehandeld op', width: '10rem' },
];

function goToWatched(record: WatchedTrademarkRecord): void {
  void router.push({ name: 'app-watched-trademark-detail', params: { id: record.id } });
}
function goToMatch(record: TrademarkMatchRecord): void {
  void router.push({ name: 'app-match-detail', params: { id: record.id } });
}
</script>

<template>
  <div class="space-y-8">
    <PageHeader title="Archief" description="Gearchiveerde merken en als niet-relevant afgehandelde matches." />

    <section class="space-y-3">
      <h2 class="text-sm font-semibold text-text">Gearchiveerde merken</h2>
      <DataTable
        :columns="watchedColumns"
        :rows="archiveQuery.data.value?.watchedTrademarks ?? []"
        :row-key="(row) => row.id"
        :loading="archiveQuery.isLoading.value"
        clickable-rows
        empty-title="Geen gearchiveerde merken"
        empty-description="Merken die u archiveert, verschijnen hier ter referentie."
        @row-click="goToWatched"
      >
        <template #cell-niceClasses="{ row }">{{ formatNiceClasses(row.niceClasses) }}</template>
        <template #cell-updatedAt="{ row }">{{ formatDate(row.updatedAt) }}</template>
      </DataTable>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-semibold text-text">Niet-relevante matches</h2>
      <DataTable
        :columns="matchColumns"
        :rows="archiveQuery.data.value?.matches ?? []"
        :row-key="(row) => row.id"
        :loading="archiveQuery.isLoading.value"
        clickable-rows
        empty-title="Geen afgehandelde matches"
        empty-description="Matches die u als niet relevant markeert, verschijnen hier."
        @row-click="goToMatch"
      >
        <template #cell-candidate="{ row }">
          <span class="font-medium">{{ row.candidate.markText }}</span>
          <StatusBadge label="Niet relevant" tone="neutral" class="ml-2" />
        </template>
        <template #cell-watched="{ row }">{{ row.watchedTrademarkLabel }}</template>
        <template #cell-score="{ row }">{{ row.totalScore }}</template>
        <template #cell-updatedAt="{ row }">{{ formatDate(row.updatedAt) }}</template>
      </DataTable>
    </section>
  </div>
</template>
