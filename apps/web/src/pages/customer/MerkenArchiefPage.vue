<script setup lang="ts">
import { useRouter } from 'vue-router';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { useArchive } from '../../api/archive';
import { formatDate, formatNiceClasses } from '../../lib/format';
import type { WatchedTrademarkRecord } from '../../api/types';

const router = useRouter();
const archiveQuery = useArchive();

const watchedColumns: readonly DataTableColumn<WatchedTrademarkRecord>[] = [
  { key: 'label', label: 'Merk' },
  { key: 'registryCode', label: 'Register', width: '8rem' },
  { key: 'niceClasses', label: 'Nice-klassen', width: '10rem' },
  { key: 'updatedAt', label: 'Gearchiveerd op', width: '10rem' },
];

function goToWatched(record: WatchedTrademarkRecord): void {
  void router.push({ name: 'app-watched-trademark-detail', params: { id: record.id } });
}
</script>

<template>
  <MwPage
    title="Merken in archief"
    description="Merken die u niet meer actief bewaakt, ter referentie."
  >
    <MwCard title="Gearchiveerde merken" :padding="false">
      <DataTable
        embedded
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
    </MwCard>
  </MwPage>
</template>
