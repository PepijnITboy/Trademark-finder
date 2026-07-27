<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '../../components/PageHeader.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import Tabs, { type TabItem } from '../../components/Tabs.vue';
import { useMatches } from '../../api/matches';
import { useWatchedTrademark } from '../../api/watched-trademarks';
import ActieveMatchesTab from './watched-trademark-detail/ActieveMatchesTab.vue';
import BewakingsinstellingenTab from './watched-trademark-detail/BewakingsinstellingenTab.vue';
import HistorieTab from './watched-trademark-detail/HistorieTab.vue';
import NotitiesTab from './watched-trademark-detail/NotitiesTab.vue';
import OfficieleGegevensTab from './watched-trademark-detail/OfficieleGegevensTab.vue';
import SamenvattingTab from './watched-trademark-detail/SamenvattingTab.vue';

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));

const watchedQuery = useWatchedTrademark(id);
const matchesQuery = useMatches();
const matchesForWatched = computed(() => (matchesQuery.data.value ?? []).filter((m) => m.watchedTrademarkId === id.value));

const TABS: readonly TabItem[] = [
  { key: 'samenvatting', label: 'Samenvatting' },
  { key: 'officiele-gegevens', label: 'Officiële gegevens' },
  { key: 'bewakingsinstellingen', label: 'Bewakingsinstellingen' },
  { key: 'actieve-matches', label: 'Actieve matches' },
  { key: 'historie', label: 'Historie' },
  { key: 'notities', label: 'Notities' },
];
const activeTab = ref<string>('samenvatting');

function backToList(): void {
  void router.push({ name: 'app-bewaakte-merken' });
}
</script>

<template>
  <div class="space-y-6">
    <button type="button" class="text-xs font-medium text-accent-strong hover:underline" @click="backToList">
      ← Terug naar bewaakte merken
    </button>

    <template v-if="watchedQuery.isLoading.value">
      <SkeletonBlock height="2rem" width="20rem" />
      <SkeletonBlock height="10rem" />
    </template>

    <template v-else-if="watchedQuery.data.value">
      <PageHeader :title="watchedQuery.data.value.label" :description="`${watchedQuery.data.value.registryCode} · ${watchedQuery.data.value.registrationNumber}`" />

      <Tabs v-model="activeTab" :tabs="TABS" />

      <SamenvattingTab v-if="activeTab === 'samenvatting'" :watched="watchedQuery.data.value" :matches="matchesForWatched" />
      <OfficieleGegevensTab v-else-if="activeTab === 'officiele-gegevens'" :watched="watchedQuery.data.value" />
      <BewakingsinstellingenTab v-else-if="activeTab === 'bewakingsinstellingen'" :watched="watchedQuery.data.value" />
      <ActieveMatchesTab
        v-else-if="activeTab === 'actieve-matches'"
        :matches="matchesForWatched"
        :loading="matchesQuery.isLoading.value"
      />
      <HistorieTab v-else-if="activeTab === 'historie'" :watched="watchedQuery.data.value" :matches="matchesForWatched" />
      <NotitiesTab v-else-if="activeTab === 'notities'" :watched="watchedQuery.data.value" />
    </template>

    <p v-else class="text-sm text-text-muted">Dit bewaakte merk kon niet worden gevonden.</p>
  </div>
</template>
