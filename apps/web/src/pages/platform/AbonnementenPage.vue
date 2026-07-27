<script setup lang="ts">
import { SUBSCRIPTION_PLANS } from '@merkwacht/domain';
import EmptyState from '../../components/EmptyState.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <div class="space-y-6">
    <PlatformPageHeader
      title="Abonnementen"
      description="Beheer van abonnementsplannen, limieten en facturatiestatus per klantorganisatie."
    />

    <div class="rounded-lg border border-border bg-surface p-5">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Beschikbare plannen</p>
      <div class="mt-2 flex gap-2">
        <StatusBadge v-for="plan in SUBSCRIPTION_PLANS" :key="plan" :label="plan" tone="neutral" />
      </div>
    </div>

    <EmptyState
      title="Abonnementenoverzicht nog niet gekoppeld"
      description="Een overzicht per klant van actief plan, status (proef, actief, betaling verlopen, opgezegd) en verbruik tegen de limieten volgt zodra de facturatie-integratie is aangesloten."
    />
  </div>
</template>
