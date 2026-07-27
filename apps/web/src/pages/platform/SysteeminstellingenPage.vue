<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { usePlatformHealth } from '../../api/platform';
import { formatDateTime } from '../../lib/format';
import PlatformPageHeader from './PlatformPageHeader.vue';

const healthQuery = usePlatformHealth();
</script>

<template>
  <div class="space-y-6">
    <PlatformPageHeader
      title="Systeeminstellingen"
      description="Omgevingsconfiguratie en systeembrede instellingen van de Merkwacht-platformlaag."
    />

    <div class="rounded-lg border border-border bg-surface p-5">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Platform-API</p>
      <div class="mt-2 flex items-center gap-3">
        <StatusBadge
          v-if="!healthQuery.isLoading.value"
          :label="healthQuery.isError.value ? 'Niet bereikbaar' : 'Operationeel'"
          :tone="healthQuery.isError.value ? 'danger' : 'success'"
        />
        <span v-if="healthQuery.data.value" class="text-xs text-text-muted">
          Service: {{ healthQuery.data.value.service }} · gecontroleerd {{ formatDateTime(healthQuery.data.value.timestamp) }}
        </span>
      </div>
    </div>

    <EmptyState
      title="Configuratiebeheer nog niet gekoppeld"
      description="Omgevingsvariabelen (registerconnectors, AI-budgetten, notificatie-instellingen) worden momenteel beheerd via serverconfiguratie en zijn nog niet bewerkbaar vanuit deze interface."
    />
  </div>
</template>
