<script setup lang="ts">
import KpiCard from '../../components/KpiCard.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { usePlatformHealth } from '../../api/platform';
import { useRegisterSources } from '../../api/register-sources';
import { formatDateTime } from '../../lib/format';
import PlatformPageHeader from './PlatformPageHeader.vue';

const healthQuery = usePlatformHealth();
const sourcesQuery = useRegisterSources();

const okSources = () => (sourcesQuery.data.value ?? []).filter((s) => s.status === 'ok').length;
</script>

<template>
  <PlatformPageHeader
    title="Platformoverzicht"
    description="Systeembrede status van de Merkwacht-infrastructuur, ongeacht individuele klantorganisaties."
  >
    <MwCard title="Systeemstatus">
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <KpiCard label="Registers actief" :value="okSources()" :loading="sourcesQuery.isLoading.value" hint="van de gekoppelde registers" />
        <div>
          <p class="text-xs font-medium text-text-muted">Laatst gecontroleerd</p>
          <p class="mt-1 text-sm text-text">
            {{ healthQuery.data.value ? formatDateTime(healthQuery.data.value.timestamp) : '—' }}
          </p>
        </div>
      </section>
    </MwCard>

    <MwBanner tone="info" title="Multi-tenant metrics volgen">
      Merkwacht draait momenteel als één werkruimte per omgeving. Klantoverstijgende metrics (aantal klanten,
      totaal aantal bewaakte merken, platformbrede matchvolumes) worden hier zichtbaar zodra de multi-tenant
      beheer-API beschikbaar is.
    </MwBanner>
  </PlatformPageHeader>
</template>
