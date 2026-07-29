<script setup lang="ts">
import { useRouter } from 'vue-router';
import { resolveProtectionDisplay } from '@merkwacht/domain';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { useWatchedTrademarks, WATCHED_TRADEMARK_STATUS_LABELS_NL } from '../../api/watched-trademarks';
import { formatDate, formatNiceClasses } from '../../lib/format';
import type { WatchedTrademarkRecord } from '../../api/types';

const router = useRouter();
const watchedTrademarksQuery = useWatchedTrademarks();

const columns: readonly DataTableColumn<WatchedTrademarkRecord>[] = [
  { key: 'label', label: 'Merk' },
  { key: 'registryCode', label: 'Register', width: '8rem' },
  { key: 'registrationNumber', label: 'Depotnummer', width: '12rem' },
  { key: 'niceClasses', label: 'Nice-klassen', width: '10rem' },
  { key: 'status', label: 'Status', width: '9rem' },
  { key: 'eligibility', label: 'Bescherming', width: '12rem' },
  { key: 'createdAt', label: 'Toegevoegd op', width: '9rem' },
];

function goToDetail(record: WatchedTrademarkRecord): void {
  void router.push({ name: 'app-watched-trademark-detail', params: { id: record.id } });
}

function protection(row: WatchedTrademarkRecord) {
  return resolveProtectionDisplay({
    status: row.status,
    eligibility: row.eligibility,
    registerMonitoringOk: row.registerMonitoringOk ?? false,
  });
}
</script>

<template>
  <MwPage title="Mijn merken" description="Beheer de merken die voor uw organisatie actief worden bewaakt.">
    <template #actions>
      <RouterLink
        :to="{ name: 'app-bewaakte-merken-nieuw' }"
        class="inline-flex items-center justify-center rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        Merk toevoegen
      </RouterLink>
    </template>

    <MwCard :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="watchedTrademarksQuery.data.value ?? []"
        :row-key="(row) => row.id"
        :loading="watchedTrademarksQuery.isLoading.value"
        clickable-rows
        empty-title="Nog geen bewaakte merken"
        empty-description="Voeg een geregistreerd merk toe om automatisch te laten controleren op nieuwe, gelijkende aanvragen."
        @row-click="goToDetail"
      >
        <template #cell-label="{ row }">
          <span class="font-medium text-text">{{ row.label }}</span>
          <span class="block text-xs text-text-muted">{{ row.markText }}</span>
        </template>
        <template #cell-niceClasses="{ row }">{{ formatNiceClasses(row.niceClasses) }}</template>
        <template #cell-status="{ row }">
          <StatusBadge
            :label="WATCHED_TRADEMARK_STATUS_LABELS_NL[row.status]"
            :tone="row.status === 'active' ? 'success' : row.status === 'archived' ? 'neutral' : 'warning'"
          />
        </template>
        <template #cell-eligibility="{ row }">
          <div>
            <StatusBadge :label="protection(row).labelNl" :tone="protection(row).tone" />
            <span class="mt-0.5 block text-xs text-text-muted">{{ protection(row).detailNl }}</span>
          </div>
        </template>
        <template #cell-createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>
      </DataTable>
    </MwCard>
  </MwPage>
</template>
