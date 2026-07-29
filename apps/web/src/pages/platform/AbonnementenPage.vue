<script setup lang="ts">
import { reactive, ref } from 'vue';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwField from '../../components/MwField.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { usePlatformPlans, useUpdatePlatformPlan } from '../../api/platform-org';
import type { PlanCatalogRecord, SubscriptionPlan } from '../../api/types';
import PlatformPageHeader from './PlatformPageHeader.vue';
import { useToastStore } from '../../stores/toast';

const plansQuery = usePlatformPlans();
const updatePlan = useUpdatePlatformPlan();
const toast = useToastStore();

const editingPlan = ref<SubscriptionPlan | null>(null);
const editForm = reactive({
  displayNameNl: '',
  priceMonthlyCents: 0,
  maxWatchedTrademarks: 0,
  maxNotificationEmails: 0,
  isActive: true,
});

const columns: readonly DataTableColumn<PlanCatalogRecord>[] = [
  { key: 'code', label: 'Code', width: '8rem' },
  { key: 'displayNameNl', label: 'Naam' },
  { key: 'priceMonthlyCents', label: 'Prijs/mnd', width: '9rem', align: 'right' },
  { key: 'maxWatchedTrademarks', label: 'Max merken', width: '8rem', align: 'right' },
  { key: 'maxNotificationEmails', label: 'Max e-mails', width: '9rem', align: 'right' },
  { key: 'isActive', label: 'Status', width: '8rem' },
  { key: 'actions', label: '', width: '12rem', align: 'right' },
];

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function startEdit(plan: PlanCatalogRecord): void {
  editingPlan.value = plan.code;
  editForm.displayNameNl = plan.displayNameNl;
  editForm.priceMonthlyCents = plan.priceMonthlyCents;
  editForm.maxWatchedTrademarks = plan.maxWatchedTrademarks;
  editForm.maxNotificationEmails = plan.maxNotificationEmails;
  editForm.isActive = plan.isActive;
}

function saveEdit(): void {
  if (!editingPlan.value) return;
  updatePlan.mutate(
    {
      code: editingPlan.value,
      patch: {
        displayNameNl: editForm.displayNameNl,
        priceMonthlyCents: editForm.priceMonthlyCents,
        maxWatchedTrademarks: editForm.maxWatchedTrademarks,
        maxNotificationEmails: editForm.maxNotificationEmails,
        isActive: editForm.isActive,
      },
    },
    {
      onSuccess: () => {
        editingPlan.value = null;
        toast.success('Plan bijgewerkt');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Opslaan mislukt'),
    },
  );
}

function toggleActive(plan: PlanCatalogRecord): void {
  updatePlan.mutate(
    { code: plan.code, patch: { isActive: !plan.isActive } },
    {
      onSuccess: () => toast.success(plan.isActive ? 'Plan uitgezet' : 'Plan geactiveerd'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Opslaan mislukt'),
    },
  );
}
</script>

<template>
  <PlatformPageHeader
    title="Abonnementen"
    description="Catalogus van abonnementsplannen. Uitgezette plannen zijn niet kiesbaar voor nieuwe of gewijzigde abonnementen."
  >
    <MwCard :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="plansQuery.data.value ?? []"
        :row-key="(row) => row.code"
        :loading="plansQuery.isLoading.value"
        empty-title="Geen plannen"
        empty-description="De abonnementencatalogus kon niet worden geladen."
      >
        <template #cell-priceMonthlyCents="{ row }">{{ formatPrice(row.priceMonthlyCents) }}</template>
        <template #cell-isActive="{ row }">
          <StatusBadge :label="row.isActive ? 'Actief' : 'Uitgezet'" :tone="row.isActive ? 'success' : 'neutral'" />
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1">
            <MwButton variant="tertiary" size="sm" @click="startEdit(row)">Bewerken</MwButton>
            <MwButton variant="tertiary" size="sm" @click="toggleActive(row)">
              {{ row.isActive ? 'Uitzetten' : 'Activeren' }}
            </MwButton>
          </div>
        </template>
      </DataTable>
    </MwCard>

    <MwCard v-if="editingPlan" title="Plan bewerken">
      <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="saveEdit">
        <MwField label="Weergavenaam" for-id="plan-name">
          <input
            id="plan-name"
            v-model="editForm.displayNameNl"
            type="text"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
        <MwField label="Prijs (centen)" for-id="plan-price">
          <input
            id="plan-price"
            v-model.number="editForm.priceMonthlyCents"
            type="number"
            min="0"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
        <MwField label="Max bewaakte merken" for-id="plan-watches">
          <input
            id="plan-watches"
            v-model.number="editForm.maxWatchedTrademarks"
            type="number"
            min="0"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
        <MwField label="Max meldingsadressen" for-id="plan-emails">
          <input
            id="plan-emails"
            v-model.number="editForm.maxNotificationEmails"
            type="number"
            min="0"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
        <div class="flex gap-2 sm:col-span-2">
          <MwButton type="submit" variant="primary" :loading="updatePlan.isPending.value">Opslaan</MwButton>
          <MwButton type="button" variant="secondary" @click="editingPlan = null">Annuleren</MwButton>
        </div>
      </form>
    </MwCard>
  </PlatformPageHeader>
</template>
