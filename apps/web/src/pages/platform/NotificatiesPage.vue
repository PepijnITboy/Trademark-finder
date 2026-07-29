<script setup lang="ts">
import { reactive, ref } from 'vue';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwField from '../../components/MwField.vue';
import MwSelect from '../../components/MwSelect.vue';
import {
  usePlatformNotificationsLog,
  usePlatformOrganizations,
  useSendPlatformNotification,
} from '../../api/platform-org';
import type { InAppNotificationRecord } from '../../api/types';
import { formatDateTime } from '../../lib/format';
import { useToastStore } from '../../stores/toast';
import PlatformPageHeader from './PlatformPageHeader.vue';

const orgsQuery = usePlatformOrganizations();
const logQuery = usePlatformNotificationsLog();
const sendMutation = useSendPlatformNotification();
const toast = useToastStore();

const form = reactive({
  organizationId: '',
  title: '',
  body: '',
});
const fieldErrors = reactive({ organizationId: '', title: '', body: '' });

const columns: readonly DataTableColumn<InAppNotificationRecord>[] = [
  { key: 'createdAt', label: 'Verstuurd', width: '11rem' },
  { key: 'organizationId', label: 'Org', width: '10rem' },
  { key: 'title', label: 'Titel' },
  { key: 'body', label: 'Bericht' },
  { key: 'readAt', label: 'Gelezen', width: '8rem' },
];

function validate(): boolean {
  fieldErrors.organizationId = form.organizationId ? '' : 'Kies een organisatie.';
  fieldErrors.title = form.title.trim() ? '' : 'Titel is verplicht.';
  fieldErrors.body = form.body.trim() ? '' : 'Bericht is verplicht.';
  return !fieldErrors.organizationId && !fieldErrors.title && !fieldErrors.body;
}

function submit(): void {
  if (!validate()) return;
  sendMutation.mutate(
    {
      organizationId: form.organizationId,
      title: form.title.trim(),
      body: form.body.trim(),
    },
    {
      onSuccess: () => {
        form.title = '';
        form.body = '';
        toast.success('Notificatie verstuurd');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Versturen mislukt'),
    },
  );
}

function orgName(id: string): string {
  return orgsQuery.data.value?.find((o) => o.id === id)?.legalName ?? id.slice(0, 8);
}
</script>

<template>
  <PlatformPageHeader
    title="Notificaties"
    description="Stuur een in-app melding naar een klantorganisatie. Dit is geen chat — alleen platform → klant."
  >
    <MwCard title="Nieuwe melding">
      <form class="grid gap-4" @submit.prevent="submit">
        <MwField label="Organisatie" for-id="notify-org" required :error="fieldErrors.organizationId">
          <MwSelect
            id="notify-org"
            v-model="form.organizationId"
            :options="[
              { value: '', label: 'Kies klant…' },
              ...(orgsQuery.data.value ?? []).map((org) => ({
                value: org.id,
                label: `${org.legalName} (${org.plan})`,
              })),
            ]"
          />
        </MwField>
        <MwField label="Titel" for-id="notify-title" required :error="fieldErrors.title">
          <input
            id="notify-title"
            v-model="form.title"
            type="text"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
        <MwField label="Bericht" for-id="notify-body" required :error="fieldErrors.body">
          <textarea
            id="notify-body"
            v-model="form.body"
            rows="4"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </MwField>
        <div>
          <MwButton type="submit" variant="primary" :loading="sendMutation.isPending.value">Versturen</MwButton>
        </div>
      </form>
    </MwCard>

    <MwCard title="Bezorglog" :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="logQuery.data.value ?? []"
        :row-key="(row) => row.id"
        :loading="logQuery.isLoading.value"
        empty-title="Nog geen notificaties"
        empty-description="Verstuurde in-app meldingen verschijnen hier."
      >
        <template #cell-createdAt="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        <template #cell-organizationId="{ row }">{{ orgName(row.organizationId) }}</template>
        <template #cell-readAt="{ row }">{{ row.readAt ? 'Ja' : 'Nee' }}</template>
      </DataTable>
    </MwCard>
  </PlatformPageHeader>
</template>
