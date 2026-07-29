<script setup lang="ts">
import { computed, ref } from 'vue';
import { sortImportSyncsForDisplay, splitImportSyncsByPurpose } from '@merkwacht/domain';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge, { type BadgeTone } from '../../components/StatusBadge.vue';
import { usePlatformImportSyncs, type PlatformImportSyncRecord } from '../../api/platform-org';
import { formatDateTime } from '../../lib/format';
import { RouterLink } from 'vue-router';
import PlatformPageHeader from './PlatformPageHeader.vue';

const syncsQuery = usePlatformImportSyncs();
const tab = ref<'watch' | 'name_research'>('watch');

const split = computed(() => splitImportSyncsByPurpose(syncsQuery.data.value ?? []));
const rows = computed(() =>
  sortImportSyncsForDisplay(tab.value === 'watch' ? split.value.watch : split.value.nameResearch),
);

const columns: readonly DataTableColumn<PlatformImportSyncRecord>[] = [
  { key: 'displayNameNl', label: 'Register' },
  { key: 'cadenceNl', label: 'Frequentie', width: '8rem' },
  { key: 'yesterdayStatus', label: 'Gisteren', width: '8rem' },
  { key: 'todayStatus', label: 'Vandaag', width: '8rem' },
  { key: 'lastSyncAt', label: 'Laatste sync', width: '11rem' },
  { key: 'lastFetchedCount', label: 'Records', width: '7rem', align: 'right' },
  { key: 'affectedOrganizationIds', label: 'Geraakte orgs' },
];

const DAY_TONES: Record<string, BadgeTone> = {
  ok: 'success',
  fail: 'danger',
  pending: 'warning',
  never: 'neutral',
};

const DAY_LABELS: Record<string, string> = {
  ok: 'Oké',
  fail: 'Mislukt',
  pending: 'Nog open',
  never: 'Nog nooit',
};
</script>

<template>
  <PlatformPageHeader
    title="Imports en verwerking"
    description="Merkbescherming draait dagelijks per register; Merkonderzoek synct op aanvraag bij een order."
  >
    <div class="mb-3 flex gap-2">
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-sm font-medium"
        :class="tab === 'watch' ? 'bg-accent-strong text-white' : 'bg-surface-muted text-text'"
        @click="tab = 'watch'"
      >
        Merkbescherming (dagelijks)
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-sm font-medium"
        :class="tab === 'name_research' ? 'bg-accent-strong text-white' : 'bg-surface-muted text-text'"
        @click="tab = 'name_research'"
      >
        Merkonderzoek (op aanvraag)
      </button>
    </div>

    <MwCard :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="rows"
        :row-key="(row) => `${row.registryCode}-${row.purpose}`"
        :loading="syncsQuery.isLoading.value"
        empty-title="Geen sync-data"
        empty-description="Nog geen import-synchronisaties bekend voor dit spoor."
      >
        <template #cell-cadenceNl="{ row }">
          {{ row.cadenceNl ?? (row.purpose === 'watch' ? 'Dagelijks' : 'Op aanvraag') }}
        </template>
        <template #cell-yesterdayStatus="{ row }">
          <StatusBadge
            :label="DAY_LABELS[row.yesterdayStatus ?? 'never']"
            :tone="DAY_TONES[row.yesterdayStatus ?? 'never']"
          />
        </template>
        <template #cell-todayStatus="{ row }">
          <StatusBadge
            :label="DAY_LABELS[row.todayStatus ?? 'pending']"
            :tone="DAY_TONES[row.todayStatus ?? 'pending']"
          />
        </template>
        <template #cell-lastSyncAt="{ row }">
          {{ row.lastSyncAt ? formatDateTime(row.lastSyncAt) : 'Nog nooit' }}
        </template>
        <template #cell-lastFetchedCount="{ row }">
          {{ row.lastFetchedCount ?? '—' }}
        </template>
        <template #cell-affectedOrganizationIds="{ row }">
          <div v-if="row.affectedOrganizationIds.length" class="flex flex-wrap gap-1">
            <RouterLink
              v-for="id in row.affectedOrganizationIds"
              :key="id"
              :to="{ name: 'platform-klant-detail', params: { orgId: id } }"
              class="text-xs text-accent-strong underline"
            >
              {{ id.slice(0, 8) }}…
            </RouterLink>
          </div>
          <span v-else class="text-text-muted">—</span>
        </template>
      </DataTable>
    </MwCard>
  </PlatformPageHeader>
</template>
