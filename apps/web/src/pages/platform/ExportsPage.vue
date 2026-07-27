<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <div class="space-y-6">
    <PlatformPageHeader
      title="Exports en opslag"
      description="Overzicht van gegenereerde dossierexports (CSV/HTML) en de opslag van ruwe connectorpayloads."
    />
    <EmptyState
      title="Exportoverzicht nog niet gekoppeld"
      description="Een logboek van alle exports per klant en de omvang van gearchiveerde ruwe registerpayloads (rawPayloadRef) verschijnt hier zodra opslagstatistieken beschikbaar zijn via een platform-API."
    />
  </div>
</template>
