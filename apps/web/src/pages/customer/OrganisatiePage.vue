<script setup lang="ts">
import { computed } from 'vue';
import EmptyState from '../../components/EmptyState.vue';
import PageHeader from '../../components/PageHeader.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import { useSettings } from '../../api/settings';
import { useWatchedTrademarks } from '../../api/watched-trademarks';

const watchedTrademarksQuery = useWatchedTrademarks();
const settingsQuery = useSettings();

const organizationId = computed(() => watchedTrademarksQuery.data.value?.[0]?.organizationId ?? settingsQuery.data.value?.organizationId ?? null);
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Organisatie en gebruikers" description="Beheer de organisatiegegevens en gebruikers die toegang hebben tot Merkwacht." />

    <SkeletonBlock v-if="watchedTrademarksQuery.isLoading.value" height="6rem" />

    <div v-else class="rounded-lg border border-border bg-surface p-5">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Organisatie-ID</p>
      <p class="mt-1 font-mono text-sm text-text">{{ organizationId ?? 'Onbekend' }}</p>
      <p class="mt-2 text-xs text-text-muted">
        Merkwacht ondersteunt momenteel één werkruimte per organisatie, gekoppeld via de ingelogde sessie.
      </p>
    </div>

    <EmptyState
      title="Gebruikersbeheer volgt in een latere fase"
      description="Het toevoegen, verwijderen en toewijzen van rollen aan gebruikers binnen uw organisatie is nog niet gekoppeld aan een beheer-API. Neem contact op met Merkwacht om gebruikers te wijzigen."
    />
  </div>
</template>
