<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue';
import PageHeader from '../../components/PageHeader.vue';
import { useWatchedTrademarks } from '../../api/watched-trademarks';

const watchedTrademarksQuery = useWatchedTrademarks();
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Abonnement en verbruik" description="Inzicht in uw huidige abonnement en het gebruik van Merkwacht." />

    <div class="rounded-lg border border-border bg-surface p-5">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Bewaakte merken in gebruik</p>
      <p class="mt-1 text-2xl font-semibold text-text">{{ watchedTrademarksQuery.data.value?.length ?? 0 }}</p>
    </div>

    <EmptyState
      title="Abonnementsbeheer nog niet gekoppeld"
      description="Facturatie, planwissels en verbruikslimieten zijn nog niet gekoppeld aan een abonnementen-API. Neem voor wijzigingen aan uw abonnement (Starter, Pro of Agency) contact op met Merkwacht."
    />
  </div>
</template>
