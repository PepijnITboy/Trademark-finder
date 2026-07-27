<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <div class="space-y-6">
    <PlatformPageHeader
      title="Klanten"
      description="Overzicht van alle klantorganisaties die Merkwacht afnemen, inclusief hun abonnement en gebruik."
    />
    <EmptyState
      title="Klantenbeheer nog niet gekoppeld"
      description="Deze pagina toont straks een overzicht van alle klantorganisaties met hun status, abonnement en aantal bewaakte merken. Dit vereist een multi-tenant beheer-API die nog niet beschikbaar is in de huidige omgeving."
    />
  </div>
</template>
