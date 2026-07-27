<script setup lang="ts">
import { computed, ref } from 'vue';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge, { type BadgeTone } from '../../components/StatusBadge.vue';
import { apiRequest } from '../../api/client';
import {
  formatEuroCents,
  usePlatformRegisterCatalog,
  type RegisterCatalogRecord,
} from '../../api/name-research';
import { useRegisterSources } from '../../api/register-sources';
import { formatDateTime } from '../../lib/format';
import type { RegisterSourceStatusRecord } from '../../api/types';
import { useToastStore } from '../../stores/toast';
import { useQueryClient } from '@tanstack/vue-query';
import PlatformPageHeader from './PlatformPageHeader.vue';

const sourcesQuery = useRegisterSources();
const catalogQuery = usePlatformRegisterCatalog();
const toast = useToastStore();
const queryClient = useQueryClient();
const savingCode = ref<string | null>(null);

const sourceColumns: readonly DataTableColumn<RegisterSourceStatusRecord>[] = [
  { key: 'displayName', label: 'Register' },
  { key: 'registryCode', label: 'Code', width: '8rem' },
  { key: 'status', label: 'Runtime-status', width: '12rem' },
  { key: 'message', label: 'Toelichting' },
  { key: 'checkedAt', label: 'Laatst gecontroleerd', width: '10rem' },
];

const catalogColumns: readonly DataTableColumn<RegisterCatalogRecord>[] = [
  { key: 'displayNameNl', label: 'Register' },
  { key: 'code', label: 'Code', width: '6rem' },
  { key: 'connectorStatus', label: 'Connector', width: '9rem' },
  { key: 'basePriceCents', label: 'Basisprijs', width: '8rem', align: 'right' },
  { key: 'enabledForNameResearch', label: 'Merkonderzoek', width: '8rem' },
  { key: 'enabledForWatch', label: 'Bewaking', width: '7rem' },
  { key: 'actions', label: '', width: '8rem' },
];

const STATUS_LABELS_NL: Record<string, string> = {
  ok: 'Actief',
  configuration_required: 'Configuratie vereist',
  degraded: 'Verminderd beschikbaar',
  unavailable: 'Niet beschikbaar',
  not_yet_supported: 'Nog niet ondersteund',
};
const STATUS_TONES: Record<string, BadgeTone> = {
  ok: 'success',
  configuration_required: 'warning',
  degraded: 'warning',
  unavailable: 'danger',
  not_yet_supported: 'neutral',
};

const CONNECTOR_LABELS: Record<string, string> = {
  live: 'Live',
  coming_soon: 'Binnenkort',
  disabled: 'Uit',
};
const CONNECTOR_TONES: Record<string, BadgeTone> = {
  live: 'success',
  coming_soon: 'warning',
  disabled: 'neutral',
};

const catalog = computed(() => catalogQuery.data.value ?? []);

async function cycleConnector(row: RegisterCatalogRecord): Promise<void> {
  const order = ['live', 'coming_soon', 'disabled'] as const;
  const idx = order.indexOf(row.connectorStatus);
  const next = order[(idx + 1) % order.length]!;
  savingCode.value = row.code;
  try {
    await apiRequest(`/api/platform/register-catalog/${row.code}`, {
      method: 'PATCH',
      body: { connectorStatus: next },
    });
    await queryClient.invalidateQueries({ queryKey: ['platform', 'register-catalog'] });
    toast.success(`${row.displayNameNl}: connector → ${CONNECTOR_LABELS[next]}`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Opslaan mislukt');
  } finally {
    savingCode.value = null;
  }
}

async function adjustPrice(row: RegisterCatalogRecord, delta: number): Promise<void> {
  const next = Math.max(0, row.basePriceCents + delta);
  savingCode.value = row.code;
  try {
    await apiRequest(`/api/platform/register-catalog/${row.code}`, {
      method: 'PATCH',
      body: { basePriceCents: next },
    });
    await queryClient.invalidateQueries({ queryKey: ['platform', 'register-catalog'] });
    toast.success(`Prijs ${row.code} bijgewerkt`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Opslaan mislukt');
  } finally {
    savingCode.value = null;
  }
}

async function toggleFlag(
  row: RegisterCatalogRecord,
  field: 'enabledForNameResearch' | 'enabledForWatch',
): Promise<void> {
  savingCode.value = row.code;
  try {
    await apiRequest(`/api/platform/register-catalog/${row.code}`, {
      method: 'PATCH',
      body: { [field]: !row[field] },
    });
    await queryClient.invalidateQueries({ queryKey: ['platform', 'register-catalog'] });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Opslaan mislukt');
  } finally {
    savingCode.value = null;
  }
}
</script>

<template>
  <PlatformPageHeader
    title="Registers en koppelingen"
    description="Catalogus voor Merkonderzoek/bewaking: connectorstatus en basisprijs per register. De merkonderzoek-prijs is alleen de som van basisprijzen (geen drempeltoeslag)."
  >
    <MwCard title="Registercatalogus (platform)" :padding="false">
      <DataTable
        embedded
        :columns="catalogColumns"
        :rows="catalog"
        :row-key="(row) => row.code"
        :loading="catalogQuery.isLoading.value"
        empty-title="Geen registers in catalogus"
      >
        <template #cell-connectorStatus="{ row }">
          <button type="button" class="inline-flex" @click="cycleConnector(row)">
            <StatusBadge
              :label="CONNECTOR_LABELS[row.connectorStatus] ?? row.connectorStatus"
              :tone="CONNECTOR_TONES[row.connectorStatus] ?? 'neutral'"
            />
          </button>
        </template>
        <template #cell-basePriceCents="{ row }">
          <span class="tabular-nums">{{ formatEuroCents(row.basePriceCents) }}</span>
        </template>
        <template #cell-enabledForNameResearch="{ row }">
          <button type="button" class="text-sm underline" @click="toggleFlag(row, 'enabledForNameResearch')">
            {{ row.enabledForNameResearch ? 'Aan' : 'Uit' }}
          </button>
        </template>
        <template #cell-enabledForWatch="{ row }">
          <button type="button" class="text-sm underline" @click="toggleFlag(row, 'enabledForWatch')">
            {{ row.enabledForWatch ? 'Aan' : 'Uit' }}
          </button>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex gap-1">
            <MwButton
              size="sm"
              variant="secondary"
              :loading="savingCode === row.code"
              @click="adjustPrice(row, -500)"
            >
              −€5
            </MwButton>
            <MwButton
              size="sm"
              variant="secondary"
              :loading="savingCode === row.code"
              @click="adjustPrice(row, 500)"
            >
              +€5
            </MwButton>
          </div>
        </template>
      </DataTable>
    </MwCard>

    <MwCard title="Runtime-koppelingen" :padding="false">
      <DataTable
        embedded
        :columns="sourceColumns"
        :rows="sourcesQuery.data.value ?? []"
        :row-key="(row) => row.registryCode"
        :loading="sourcesQuery.isLoading.value"
        empty-title="Geen registerkoppelingen bekend"
      >
        <template #cell-status="{ row }">
          <StatusBadge :label="STATUS_LABELS_NL[row.status] ?? row.status" :tone="STATUS_TONES[row.status] ?? 'neutral'" />
        </template>
        <template #cell-message="{ row }"><span class="text-text-muted">{{ row.message }}</span></template>
        <template #cell-checkedAt="{ row }">{{ formatDateTime(row.checkedAt) }}</template>
      </DataTable>
    </MwCard>
  </PlatformPageHeader>
</template>
