<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue';
import MwCard from '../../components/MwCard.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <PlatformPageHeader
    title="Exports en opslag"
    description="Overzicht van gegenereerde dossierexports (CSV/HTML) en de opslag van ruwe connectorpayloads."
  >
    <MwCard>
      <EmptyState
        :dashed="false"
        title="Exportoverzicht nog niet gekoppeld"
        description="Een logboek van alle exports per klant en de omvang van gearchiveerde ruwe registerpayloads (rawPayloadRef) verschijnt hier zodra opslagstatistieken beschikbaar zijn via een platform-API."
      />
    </MwCard>
  </PlatformPageHeader>
</template>
