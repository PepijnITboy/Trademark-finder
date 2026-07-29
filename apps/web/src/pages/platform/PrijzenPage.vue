<script setup lang="ts">
import { ref } from 'vue';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwField from '../../components/MwField.vue';
import { apiRequest } from '../../api/client';
import {
  formatEuroCents,
  usePlatformRegisterCatalog,
  type RegisterCatalogRecord,
} from '../../api/name-research';
import { useToastStore } from '../../stores/toast';
import { useQueryClient } from '@tanstack/vue-query';
import PlatformPageHeader from './PlatformPageHeader.vue';

const catalogQuery = usePlatformRegisterCatalog();
const toast = useToastStore();
const queryClient = useQueryClient();
const editingCode = ref<string | null>(null);
const priceEuro = ref('');
const saving = ref(false);

const columns: readonly DataTableColumn<RegisterCatalogRecord>[] = [
  { key: 'displayNameNl', label: 'Register / product' },
  { key: 'code', label: 'Code', width: '7rem' },
  { key: 'basePriceCents', label: 'Basisprijs', width: '9rem', align: 'right' },
  { key: 'enabledForNameResearch', label: 'Merkonderzoek', width: '9rem' },
  { key: 'enabledForWatch', label: 'Bewaking', width: '8rem' },
  { key: 'actions', label: '', width: '8rem', align: 'right' },
];

function startEdit(row: RegisterCatalogRecord): void {
  editingCode.value = row.code;
  priceEuro.value = (row.basePriceCents / 100).toFixed(2);
}

async function savePrice(): Promise<void> {
  if (!editingCode.value) return;
  const parsed = Number.parseFloat(priceEuro.value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    toast.error('Voer een geldige prijs in (vrij bedrag in euro).');
    return;
  }
  saving.value = true;
  try {
    await apiRequest(`/api/platform/register-catalog/${editingCode.value}`, {
      method: 'PATCH',
      body: { basePriceCents: Math.round(parsed * 100) },
    });
    await queryClient.invalidateQueries({ queryKey: ['platform', 'register-catalog'] });
    toast.success('Prijs bijgewerkt');
    editingCode.value = null;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Opslaan mislukt');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <PlatformPageHeader
    title="Prijzen"
    description="Vrije prijsinvoer voor registers en merkonderzoek-producten. Health van koppelingen staat onder Operatie → Registers."
  >
    <MwCard :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="catalogQuery.data.value ?? []"
        :row-key="(row) => row.code"
        :loading="catalogQuery.isLoading.value"
        empty-title="Geen catalogus"
        empty-description="Registercatalogus kon niet worden geladen."
      >
        <template #cell-basePriceCents="{ row }">
          <span class="tabular-nums">{{ formatEuroCents(row.basePriceCents) }}</span>
        </template>
        <template #cell-enabledForNameResearch="{ row }">
          {{ row.enabledForNameResearch ? 'Ja' : 'Nee' }}
        </template>
        <template #cell-enabledForWatch="{ row }">
          {{ row.enabledForWatch ? 'Ja' : 'Nee' }}
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end">
            <MwButton variant="tertiary" size="sm" @click="startEdit(row)">Prijs bewerken</MwButton>
          </div>
        </template>
      </DataTable>
    </MwCard>

    <MwCard v-if="editingCode" title="Prijs bewerken">
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="savePrice">
        <MwField :label="`Basisprijs voor ${editingCode} (€)`" for-id="price-euro">
          <input
            id="price-euro"
            v-model="priceEuro"
            type="text"
            inputmode="decimal"
            class="w-40 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            placeholder="49.00"
          />
        </MwField>
        <MwButton type="submit" variant="primary" :loading="saving">Opslaan</MwButton>
        <MwButton type="button" variant="secondary" @click="editingCode = null">Annuleren</MwButton>
      </form>
    </MwCard>
  </PlatformPageHeader>
</template>
