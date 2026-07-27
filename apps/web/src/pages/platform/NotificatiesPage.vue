<script setup lang="ts">
import { NOTIFICATION_CHANNELS } from '@merkwacht/domain';
import EmptyState from '../../components/EmptyState.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <PlatformPageHeader
    title="Notificaties"
    description="Platformbrede bezorgstatus van meldingen naar klantorganisaties, los van de meldingen die klanten zelf zien."
  >
    <MwCard title="Ondersteunde kanalen">
      <div class="flex flex-wrap gap-2">
        <StatusBadge v-for="channel in NOTIFICATION_CHANNELS" :key="channel" :label="channel" tone="neutral" />
      </div>
    </MwCard>

    <MwCard>
      <EmptyState
        :dashed="false"
        title="Bezorgmonitoring nog niet gekoppeld"
        description="Slaagpercentages, bounces en achterstand per kanaal (e-mail, in-app) verschijnen hier zodra de notificatiedienst deze statistieken rapporteert aan het platform."
      />
    </MwCard>
  </PlatformPageHeader>
</template>
