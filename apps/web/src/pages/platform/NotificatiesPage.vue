<script setup lang="ts">
import { NOTIFICATION_CHANNELS } from '@merkwacht/domain';
import EmptyState from '../../components/EmptyState.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <div class="space-y-6">
    <PlatformPageHeader
      title="Notificaties"
      description="Platformbrede bezorgstatus van meldingen naar klantorganisaties, los van de meldingen die klanten zelf zien."
    />

    <div class="rounded-lg border border-border bg-surface p-5">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Ondersteunde kanalen</p>
      <div class="mt-2 flex gap-2">
        <StatusBadge v-for="channel in NOTIFICATION_CHANNELS" :key="channel" :label="channel" tone="neutral" />
      </div>
    </div>

    <EmptyState
      title="Bezorgmonitoring nog niet gekoppeld"
      description="Slaagpercentages, bounces en achterstand per kanaal (e-mail, in-app) verschijnen hier zodra de notificatiedienst deze statistieken rapporteert aan het platform."
    />
  </div>
</template>
