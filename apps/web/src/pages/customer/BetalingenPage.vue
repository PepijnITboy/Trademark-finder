<script setup lang="ts">
import { computed } from 'vue';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { useBillingCheckout } from '../../api/billing';
import { INVOICE_STATUS_LABELS_NL, invoicePdfUrl, invoiceUblUrl, useInvoices } from '../../api/invoices';
import type { InvoiceRecord } from '../../api/types';
import { formatDate } from '../../lib/format';
import { useToastStore } from '../../stores/toast';

const invoicesQuery = useInvoices();
const checkout = useBillingCheckout();
const toast = useToastStore();

const invoices = computed(() => invoicesQuery.data.value ?? []);
const openInvoices = computed(() => invoices.value.filter((i) => i.status === 'open'));
const outstandingCents = computed(() => openInvoices.value.reduce((sum, i) => sum + i.amountCents, 0));
const paidCount = computed(() => invoices.value.filter((i) => i.status === 'paid').length);

const columns: readonly DataTableColumn<InvoiceRecord>[] = [
  { key: 'number', label: 'Nummer', width: '10rem' },
  { key: 'status', label: 'Status', width: '9rem' },
  { key: 'exVatCents', label: 'Excl. BTW', width: '8rem', align: 'right' },
  { key: 'btwCents', label: 'BTW 21%', width: '8rem', align: 'right' },
  { key: 'amountCents', label: 'Incl. BTW', width: '9rem', align: 'right' },
  { key: 'description', label: 'Omschrijving' },
  { key: 'createdAt', label: 'Datum', width: '9rem' },
  { key: 'actions', label: '', width: '16rem', align: 'right' },
];

function formatAmount(cents: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function statusTone(status: InvoiceRecord['status']): 'warning' | 'success' | 'neutral' {
  if (status === 'open') return 'warning';
  if (status === 'paid') return 'success';
  return 'neutral';
}

function openCheckoutUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function addPaymentMethod(): void {
  checkout.mutate(
    { purpose: 'add_payment_method' },
    {
      onSuccess: (result) => openCheckoutUrl(result.url),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Checkout mislukt'),
    },
  );
}

function payInvoice(invoice: InvoiceRecord): void {
  checkout.mutate(
    { purpose: 'pay_invoice', invoiceId: invoice.id },
    {
      onSuccess: (result) => openCheckoutUrl(result.url),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Betaling mislukt'),
    },
  );
}
</script>

<template>
  <MwPage title="Betalingen" description="Overzicht van facturen en betalingen voor uw Merkwacht-abonnement en merkonderzoek.">
    <template #actions>
      <MwButton variant="secondary" :loading="checkout.isPending.value" @click="addPaymentMethod">
        Betaling toevoegen
      </MwButton>
    </template>

    <MwBanner v-if="invoicesQuery.isError.value" tone="danger" title="Facturen konden niet worden geladen">
      Probeer de pagina te verversen.
    </MwBanner>

    <div class="grid gap-3 sm:grid-cols-3">
      <MwCard title="Openstaand">
        <p class="text-2xl font-semibold tabular-nums text-text">{{ formatAmount(outstandingCents) }}</p>
        <p class="mt-1 text-xs text-text-muted">{{ openInvoices.length }} openstaande factuur(en)</p>
      </MwCard>
      <MwCard title="Betaald">
        <p class="text-2xl font-semibold tabular-nums text-text">{{ paidCount }}</p>
        <p class="mt-1 text-xs text-text-muted">Afgeronde facturen</p>
      </MwCard>
      <MwCard title="Status">
        <StatusBadge
          :label="outstandingCents > 0 ? 'Openstaand bedrag' : 'Alles betaald'"
          :tone="outstandingCents > 0 ? 'warning' : 'success'"
        />
      </MwCard>
    </div>

    <MwCard :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="invoices"
        :row-key="(row) => row.id"
        :loading="invoicesQuery.isLoading.value"
        empty-title="Geen facturen"
        empty-description="Er zijn nog geen facturen voor uw organisatie."
      >
        <template #cell-status="{ row }">
          <StatusBadge :label="INVOICE_STATUS_LABELS_NL[row.status]" :tone="statusTone(row.status)" />
        </template>
        <template #cell-exVatCents="{ row }">
          <span class="tabular-nums">{{ formatAmount(row.exVatCents ?? Math.round(row.amountCents / 1.21)) }}</span>
        </template>
        <template #cell-btwCents="{ row }">
          <span class="tabular-nums">{{ formatAmount(row.btwCents ?? row.amountCents - Math.round(row.amountCents / 1.21)) }}</span>
        </template>
        <template #cell-amountCents="{ row }">
          <span class="tabular-nums">{{ formatAmount(row.amountCents) }}</span>
        </template>
        <template #cell-createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-2">
            <MwButton
              v-if="row.status === 'open'"
              variant="primary"
              size="sm"
              :loading="checkout.isPending.value"
              @click="payInvoice(row)"
            >
              Betalen
            </MwButton>
            <a
              v-if="row.pdfAvailable"
              :href="invoicePdfUrl(row.id)"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface-muted"
            >
              PDF
            </a>
            <a
              v-if="row.ublXmlAvailable !== false"
              :href="invoiceUblUrl(row.id)"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface-muted"
            >
              UBL
            </a>
          </div>
        </template>
      </DataTable>
    </MwCard>
  </MwPage>
</template>
