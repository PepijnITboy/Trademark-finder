<script setup lang="ts">
import { useRouter } from 'vue-router';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { usePlatformOrganizations } from '../../api/platform-org';
import type { PlatformOrganizationListItem } from '../../api/types';
import { formatDate } from '../../lib/format';
import PlatformPageHeader from './PlatformPageHeader.vue';

const router = useRouter();
const orgsQuery = usePlatformOrganizations();

const columns: readonly DataTableColumn<PlatformOrganizationListItem>[] = [
  { key: 'legalName', label: 'Klant' },
  { key: 'plan', label: 'Plan', width: '8rem' },
  { key: 'status', label: 'Status', width: '9rem' },
  { key: 'since', label: 'Sinds', width: '9rem' },
  { key: 'openInvoiceCount', label: 'Open facturen', width: '8rem', align: 'right' },
  { key: 'watchedTrademarkCount', label: 'Merken', width: '7rem', align: 'right' },
  { key: 'memberCount', label: 'Users', width: '6rem', align: 'right' },
];

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'trialing') return 'warning';
  if (status === 'past_due') return 'danger';
  return 'neutral';
}

function goToDetail(row: PlatformOrganizationListItem): void {
  void router.push({ name: 'platform-klant-detail', params: { orgId: row.id } });
}
</script>

<template>
  <PlatformPageHeader
    title="Klanten"
    description="Overzicht van alle klantorganisaties. Open een rij voor het volledige klantprofiel."
  >
    <MwCard :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="orgsQuery.data.value ?? []"
        :row-key="(row) => row.id"
        :loading="orgsQuery.isLoading.value"
        clickable-rows
        empty-title="Geen klanten"
        empty-description="Er zijn nog geen organisaties in de demo-seed."
        @row-click="goToDetail"
      >
        <template #cell-legalName="{ row }">
          <span class="font-medium text-text">{{ row.legalName }}</span>
        </template>
        <template #cell-plan="{ row }">
          <span class="capitalize">{{ row.plan }}</span>
        </template>
        <template #cell-status="{ row }">
          <StatusBadge :label="row.status" :tone="statusTone(row.status)" />
        </template>
        <template #cell-since="{ row }">{{ formatDate(row.since) }}</template>
      </DataTable>
    </MwCard>
  </PlatformPageHeader>
</template>
