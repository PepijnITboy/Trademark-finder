<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import StatusBadge, { type BadgeTone } from '../../components/StatusBadge.vue';
import {
  formatEuroCents,
  formatScopeSummary,
  useNameResearchCredits,
  useNameResearchOrders,
  type NameResearchOrderRecord,
} from '../../api/name-research';
import { formatDate } from '../../lib/format';
import { NAME_RESEARCH_DISCLAIMER_NL } from '@merkwacht/domain';

const router = useRouter();
const ordersQuery = useNameResearchOrders();
const creditsQuery = useNameResearchCredits();

const orders = computed(() => ordersQuery.data.value ?? []);
const credits = computed(() => creditsQuery.data.value);

const columns: readonly DataTableColumn<NameResearchOrderRecord>[] = [
  { key: 'markText', label: 'Merknaam' },
  { key: 'status', label: 'Status', width: '9rem' },
  { key: 'risk', label: 'Risico', width: '7rem' },
  { key: 'price', label: 'Prijs', width: '7rem', align: 'right' },
  { key: 'createdAt', label: 'Aangemaakt', width: '9rem' },
];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Concept',
  awaiting_payment: 'Wacht op betaling',
  queued: 'In wachtrij',
  running: 'Bezig',
  completed: 'Afgerond',
  failed: 'Mislukt',
  canceled: 'Geannuleerd',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  completed: 'success',
  running: 'warning',
  queued: 'warning',
  awaiting_payment: 'warning',
  failed: 'danger',
  canceled: 'neutral',
  draft: 'neutral',
};

function go(order: NameResearchOrderRecord): void {
  void router.push({ name: 'app-merkonderzoek-detail', params: { id: order.id } });
}
</script>

<template>
  <MwPage
    title="Merkonderzoek rapporten"
    description="Overzicht van pre-filing scans. Gescheiden van Merkbescherming (oppositie op eigen merken)."
  >
    <p class="text-xs leading-relaxed text-text-muted">{{ NAME_RESEARCH_DISCLAIMER_NL }}</p>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <MwCard title="Credits">
        <p class="text-2xl font-semibold tabular-nums">
          {{ credits?.balance ?? '—' }}
          <span class="text-sm font-normal text-text-muted">beschikbaar</span>
        </p>
        <p class="mt-1 text-xs text-text-muted">
          Gebruikt deze periode: {{ credits?.usedThisPeriod ?? 0 }}
        </p>
      </MwCard>
      <MwCard title="Rapporten">
        <p class="text-2xl font-semibold tabular-nums">{{ orders.length }}</p>
      </MwCard>
    </div>

    <MwCard title="Alle onderzoeken" :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="orders"
        :row-key="(row) => row.id"
        :loading="ordersQuery.isLoading.value"
        clickable-rows
        empty-title="Nog geen merkonderzoeken"
        empty-description="Start een nieuwe aanvraag via Merkonderzoek in het menu."
        @row-click="go"
      >
        <template #cell-markText="{ row }">
          <span class="font-medium">{{ row.markText }}</span>
          <span class="ml-1 block text-xs text-text-muted sm:inline">
            {{ formatScopeSummary(row.scopes) }}
          </span>
        </template>
        <template #cell-status="{ row }">
          <StatusBadge
            :label="STATUS_LABELS[row.status] ?? row.status"
            :tone="STATUS_TONES[row.status] ?? 'neutral'"
          />
        </template>
        <template #cell-risk="{ row }">
          <span v-if="row.overallRiskScore != null" class="tabular-nums">
            {{ Math.round(row.overallRiskScore) }}%
          </span>
          <span v-else class="text-text-muted">—</span>
        </template>
        <template #cell-price="{ row }">
          {{ row.creditUsed ? '1 credit' : formatEuroCents(row.priceCents) }}
        </template>
        <template #cell-createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>
      </DataTable>
    </MwCard>
  </MwPage>
</template>
