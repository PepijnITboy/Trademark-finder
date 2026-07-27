<script setup lang="ts">
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { useRegisterSources } from '../../api/register-sources';
import { formatDateTime } from '../../lib/format';
import type { RegisterSourceStatusRecord } from '../../api/types';
import type { BadgeTone } from '../../components/StatusBadge.vue';

const sourcesQuery = useRegisterSources();

const columns: readonly DataTableColumn<RegisterSourceStatusRecord>[] = [
  { key: 'displayName', label: 'Register' },
  { key: 'status', label: 'Status', width: '12rem' },
  { key: 'message', label: 'Toelichting' },
  { key: 'checkedAt', label: 'Laatst gecontroleerd', width: '10rem' },
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
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Databronnen"
      description="Status van de registerkoppelingen die Merkwacht gebruikt om nieuwe publicaties op te sporen."
    />

    <DataTable
      :columns="columns"
      :rows="sourcesQuery.data.value ?? []"
      :row-key="(row) => row.registryCode"
      :loading="sourcesQuery.isLoading.value"
      empty-title="Geen registerkoppelingen bekend"
    >
      <template #cell-status="{ row }">
        <StatusBadge :label="STATUS_LABELS_NL[row.status] ?? row.status" :tone="STATUS_TONES[row.status] ?? 'neutral'" />
      </template>
      <template #cell-message="{ row }">
        <span class="text-text-muted">{{ row.message }}</span>
      </template>
      <template #cell-checkedAt="{ row }">{{ formatDateTime(row.checkedAt) }}</template>
    </DataTable>

    <p class="text-xs text-text-muted">
      Merkwacht ondersteunt bij lancering uitsluitend het BOIP-register (Benelux). Overige registers worden
      hierboven getoond zodra ondersteuning actief in ontwikkeling is.
    </p>
  </div>
</template>
