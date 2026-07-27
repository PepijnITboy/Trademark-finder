<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { usePlatformHealth } from '../../api/platform';
import { formatDateTime } from '../../lib/format';
import PlatformPageHeader from './PlatformPageHeader.vue';

const healthQuery = usePlatformHealth();
</script>

<template>
  <PlatformPageHeader
    title="Systeeminstellingen"
    description="Omgevingsconfiguratie en systeembrede instellingen van de Merkwacht-platformlaag."
  >
    <MwCard title="Platform-API">
      <div class="flex flex-wrap items-center gap-3">
        <StatusBadge
          v-if="!healthQuery.isLoading.value"
          :label="healthQuery.isError.value ? 'Niet bereikbaar' : 'Operationeel'"
          :tone="healthQuery.isError.value ? 'danger' : 'success'"
        />
        <div v-else class="h-5 w-24 animate-pulse rounded bg-surface-muted" />
        <span v-if="healthQuery.data.value" class="text-sm text-text-muted">
          Service: {{ healthQuery.data.value.service }} · gecontroleerd {{ formatDateTime(healthQuery.data.value.timestamp) }}
        </span>
      </div>
    </MwCard>

    <MwCard>
      <EmptyState
        :dashed="false"
        title="Configuratiebeheer nog niet gekoppeld"
        description="Omgevingsvariabelen (registerconnectors, AI-budgetten, notificatie-instellingen) worden momenteel beheerd via serverconfiguratie en zijn nog niet bewerkbaar vanuit deze interface."
      />
    </MwCard>
  </PlatformPageHeader>
</template>
