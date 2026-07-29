<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import KpiCard from '../../components/KpiCard.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { apiRequest } from '../../api/client';
import { usePlatformHealth } from '../../api/platform';
import type { RegisterCatalogRecord } from '../../api/name-research';
import { formatDateTime } from '../../lib/format';
import PlatformPageHeader from './PlatformPageHeader.vue';

interface RuntimeState {
  registryCode: string;
  lastProbeStatus: string | null;
}

const healthQuery = usePlatformHealth();

const cockpitQuery = useQuery({
  queryKey: ['platform', 'register-catalog', 'cockpit', 'overview-kpis'],
  queryFn: async () =>
    apiRequest<{
      registers: readonly RegisterCatalogRecord[];
      runtime: readonly RuntimeState[];
    }>('/api/platform/register-catalog/cockpit'),
});

const runtimeByCode = computed(() => {
  const map = new Map<string, RuntimeState>();
  for (const r of cockpitQuery.data.value?.runtime ?? []) map.set(r.registryCode, r);
  return map;
});

function isActief(row: RegisterCatalogRecord): boolean {
  const rt = runtimeByCode.value.get(row.code);
  return row.connectorStatus === 'live' && row.enabledForWatch && rt?.lastProbeStatus === 'ok';
}

const registersActief = computed(
  () => (cockpitQuery.data.value?.registers ?? []).filter(isActief).length,
);
const registersNietActief = computed(() => {
  const all = cockpitQuery.data.value?.registers ?? [];
  return Math.max(0, all.length - registersActief.value);
});
</script>

<template>
  <PlatformPageHeader
    title="Platformoverzicht"
    description="Systeembrede status van de Merkwacht-infrastructuur, ongeacht individuele klantorganisaties."
  >
    <MwCard title="Systeemstatus">
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p class="text-xs font-medium text-text-muted">API-status</p>
          <div class="mt-2">
            <StatusBadge
              v-if="!healthQuery.isLoading.value"
              :label="healthQuery.isError.value ? 'Niet bereikbaar' : 'Operationeel'"
              :tone="healthQuery.isError.value ? 'danger' : 'success'"
            />
            <div v-else class="h-5 w-24 animate-pulse rounded bg-surface-muted" />
          </div>
        </div>
        <KpiCard
          label="Registers actief"
          :value="registersActief"
          :loading="cockpitQuery.isLoading.value"
          hint="live + aan voor klanten + groene test"
        />
        <KpiCard
          label="Registers niet actief"
          :value="registersNietActief"
          :loading="cockpitQuery.isLoading.value"
          hint="uit, geen test, of niet aangezet"
        />
        <div>
          <p class="text-xs font-medium text-text-muted">Laatst gecontroleerd</p>
          <p class="mt-1 text-sm text-text">
            {{ healthQuery.data.value ? formatDateTime(healthQuery.data.value.timestamp) : '—' }}
          </p>
        </div>
      </section>
    </MwCard>

    <MwBanner tone="info" title="Catalogus-waarheid">
      Registers actief telt alleen connectors die live staan, voor klanten aan staan, én een geslaagde
      verbindingstest hebben — dezelfde regel als “Beschermd” bij klantmerken.
    </MwBanner>
  </PlatformPageHeader>
</template>
