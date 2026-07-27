<script setup lang="ts">
import { computed } from 'vue';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge, { type BadgeTone } from '../../components/StatusBadge.vue';
import {
  formatEuroCents,
  formatScopeSummary,
  usePlatformNameResearchOrders,
  type NameResearchOrderRecord,
} from '../../api/name-research';
import { formatDateTime } from '../../lib/format';
import PlatformPageHeader from './PlatformPageHeader.vue';

const ordersQuery = usePlatformNameResearchOrders();
const orders = computed(() => ordersQuery.data.value ?? []);

const columns: readonly DataTableColumn<NameResearchOrderRecord>[] = [
  { key: 'markText', label: 'Merknaam' },
  { key: 'organizationId', label: 'Organisatie', width: '10rem' },
  { key: 'status', label: 'Status', width: '8rem' },
  { key: 'scopes', label: 'Scopes' },
  { key: 'threshold', label: 'Drempel', width: '5rem' },
  { key: 'risk', label: 'Risico', width: '5rem' },
  { key: 'price', label: 'Betaling', width: '7rem' },
  { key: 'updatedAt', label: 'Bijgewerkt', width: '9rem' },
];

const STATUS_TONES: Record<string, BadgeTone> = {
  completed: 'success',
  running: 'warning',
  queued: 'warning',
  awaiting_payment: 'warning',
  failed: 'danger',
};
</script>

<template>
  <PlatformPageHeader
    title="Merkonderzoek"
    description="Alle pre-filing orders met scopes (register + klassen), drempel en voortgang. Gescheiden van Matches/scoring. Prijs = som registerbasisprijzen uit de catalogus."
  >
    <MwCard title="Orders" :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="orders"
        :row-key="(row) => row.id"
        :loading="ordersQuery.isLoading.value"
        empty-title="Nog geen merkonderzoek-orders"
      >
        <template #cell-markText="{ row }">
          <span class="font-medium">{{ row.markText }}</span>
          <span v-if="row.intendedNicheNl" class="mt-0.5 block text-xs text-text-muted">
            {{ row.intendedNicheNl }}
          </span>
        </template>
        <template #cell-organizationId="{ row }">
          <span class="truncate font-mono text-xs">{{ row.organizationId }}</span>
        </template>
        <template #cell-status="{ row }">
          <StatusBadge :label="row.status" :tone="STATUS_TONES[row.status] ?? 'neutral'" />
        </template>
        <template #cell-scopes="{ row }">
          <span class="text-xs text-text-muted">{{ formatScopeSummary(row.scopes) }}</span>
        </template>
        <template #cell-threshold="{ row }">
          <span class="tabular-nums">{{ row.minScoreThreshold }}%</span>
        </template>
        <template #cell-risk="{ row }">
          <span v-if="row.overallRiskScore != null" class="tabular-nums">
            {{ Math.round(row.overallRiskScore) }}%
          </span>
          <span v-else>—</span>
        </template>
        <template #cell-price="{ row }">
          {{ row.creditUsed ? 'credit' : formatEuroCents(row.priceCents) }}
        </template>
        <template #cell-updatedAt="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
      </DataTable>
    </MwCard>
  </PlatformPageHeader>
</template>
