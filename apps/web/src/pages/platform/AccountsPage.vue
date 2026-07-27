<script setup lang="ts">
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { MEMBER_ROLE_LABELS_NL, useOrganizationMembers } from '../../api/organization';
import type { OrganizationMemberRecord } from '../../api/types';
import PlatformPageHeader from './PlatformPageHeader.vue';

const membersQuery = useOrganizationMembers();

const columns: readonly DataTableColumn<OrganizationMemberRecord>[] = [
  { key: 'displayName', label: 'Naam' },
  { key: 'email', label: 'E-mail' },
  { key: 'role', label: 'Rol', width: '8rem' },
  { key: 'jobTitle', label: 'Functie', width: '10rem' },
];
</script>

<template>
  <PlatformPageHeader
    title="Accounts"
    description="Gebruikers van de klantorganisatie zoals doorgespeeld vanuit Organisatie → Gebruikers."
  >
    <MwCard title="Leden" :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="membersQuery.data.value ?? []"
        :row-key="(row) => row.id"
        :loading="membersQuery.isLoading.value"
        empty-title="Geen accounts"
        empty-description="Nog geen gebruikers in de demo-organisatie."
      >
        <template #cell-role="{ row }">
          <StatusBadge :label="MEMBER_ROLE_LABELS_NL[row.role] ?? row.role" tone="accent" />
        </template>
        <template #cell-jobTitle="{ row }">{{ row.jobTitle || '—' }}</template>
      </DataTable>
    </MwCard>
  </PlatformPageHeader>
</template>
