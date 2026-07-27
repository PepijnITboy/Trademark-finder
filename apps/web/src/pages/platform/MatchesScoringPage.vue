<script setup lang="ts">
import { ref } from 'vue';
import EmptyState from '../../components/EmptyState.vue';
import MwCard from '../../components/MwCard.vue';
import ScoreBar from '../../components/ScoreBar.vue';
import Tabs, { type TabItem } from '../../components/Tabs.vue';
import { SCORE_COMPONENTS, SCORE_WEIGHT_PROFILE_ID } from '../../lib/score-weights';
import PlatformPageHeader from './PlatformPageHeader.vue';

const TABS: readonly TabItem[] = [
  { key: 'weights', label: 'Weegprofiel' },
  { key: 'testlab', label: 'Testlab' },
];
const activeTab = ref('weights');
</script>

<template>
  <PlatformPageHeader
    title="Matches en scoring"
    description="Configuratie van het scoringsmodel dat matches tussen bewaakte merken en kandidaat-aanvragen beoordeelt."
  >
    <Tabs v-model="activeTab" :tabs="TABS" />

    <MwCard v-if="activeTab === 'weights'" title="Actief weegprofiel">
      <template #actions>
        <span class="text-xs text-text-muted">Profiel {{ SCORE_WEIGHT_PROFILE_ID }}</span>
      </template>
      <div class="space-y-3">
        <ScoreBar
          v-for="component in SCORE_COMPONENTS"
          :key="component.key"
          :label="component.labelNl"
          :value="component.weight / 100"
          :weight="component.weight"
          compact
        />
      </div>
      <p class="mt-3 text-xs text-text-muted">
        Gewichten tellen op tot 100 en zijn identiek voor alle klantorganisaties. Versiebeheer per profiel volgt
        wanneer meerdere weegprofielen tegelijk actief kunnen zijn.
      </p>
    </MwCard>

    <MwCard v-else>
      <EmptyState
        :dashed="false"
        title="Testlab nog niet beschikbaar"
        description="Het testlab zal beheerders in staat stellen om twee merknamen en klassen handmatig in te voeren en de resulterende score-uitsplitsing te bekijken, zonder een echte match aan te maken. Dit vereist een aparte, niet-persisterende scoring-endpoint die nog niet is blootgesteld door de API."
      />
    </MwCard>
  </PlatformPageHeader>
</template>
