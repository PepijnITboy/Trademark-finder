<script setup lang="ts">
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { usePlatformBillingInvoices } from '../../api/billing';
import { INVOICE_STATUS_LABELS_NL } from '../../api/invoices';
import type { PlatformInvoiceRecord } from '../../api/types';
import { formatDate } from '../../lib/format';
import PlatformPageHeader from './PlatformPageHeader.vue';

const invoicesQuery = usePlatformBillingInvoices();

const columns: readonly DataTableColumn<PlatformInvoiceRecord>[] = [
  { key: 'organizationName', label: 'Organisatie', width: '14rem' },
  { key: 'number', label: 'Nummer', width: '10rem' },
  { key: 'status', label: 'Status', width: '9rem' },
  { key: 'amountCents', label: 'Bedrag', width: '9rem', align: 'right' },
  { key: 'description', label: 'Omschrijving' },
  { key: 'createdAt', label: 'Datum', width: '9rem' },
];

function formatAmount(cents: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function statusTone(status: PlatformInvoiceRecord['status']): 'warning' | 'success' | 'neutral' {
  if (status === 'open') return 'warning';
  if (status === 'paid') return 'success';
  return 'neutral';
}
</script>

<template>
  <PlatformPageHeader
    title="Betalingen"
    description="Facturen en betalingen over alle klantorganisaties."
  >
    <MwCard :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="invoicesQuery.data.value ?? []"
        :row-key="(row) => row.id"
        :loading="invoicesQuery.isLoading.value"
        empty-title="Geen facturen"
        empty-description="Er zijn nog geen facturen geregistreerd."
      >
        <template #cell-status="{ row }">
          <StatusBadge :label="INVOICE_STATUS_LABELS_NL[row.status]" :tone="statusTone(row.status)" />
        </template>
        <template #cell-amountCents="{ row }">
          <span class="tabular-nums">{{ formatAmount(row.amountCents) }}</span>
        </template>
        <template #cell-createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>
      </DataTable>
    </MwCard>
  </PlatformPageHeader>
</template>
