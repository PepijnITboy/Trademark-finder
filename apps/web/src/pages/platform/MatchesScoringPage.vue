<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import EmptyState from '../../components/EmptyState.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import Tabs, { type TabItem } from '../../components/Tabs.vue';
import { apiRequest } from '../../api/client';
import { SCORE_COMPONENTS } from '../../lib/score-weights';
import { useToastStore } from '../../stores/toast';
import PlatformPageHeader from './PlatformPageHeader.vue';

const TABS: readonly TabItem[] = [
  { key: 'weights', label: 'Weegprofiel' },
  { key: 'testlab', label: 'Testlab' },
];
const activeTab = ref('weights');
const toast = useToastStore();
const queryClient = useQueryClient();

type Weights = Record<(typeof SCORE_COMPONENTS)[number]['key'], number>;

const drafts = reactive<Weights>({
  textualSimilarity: 25,
  phoneticSimilarity: 22,
  niceClassOverlap: 17,
  visualSimilarity: 13,
  goodsServicesOverlap: 8,
  semanticSimilarity: 8,
  geographicOverlap: 4,
  aiPlausibilityAdjustment: 3,
});

const weightsQuery = useQuery({
  queryKey: ['platform', 'scoring', 'weights'],
  queryFn: async () =>
    apiRequest<{
      active: { id: string; weights: Weights };
      profiles: readonly { id: string }[];
    }>('/api/platform/scoring/weights'),
});

watch(
  () => weightsQuery.data.value?.active,
  (active) => {
    if (!active) return;
    Object.assign(drafts, active.weights);
  },
  { immediate: true },
);

const sum = computed(() => Object.values(drafts).reduce((a, b) => a + Number(b || 0), 0));
const valid = computed(() => Math.abs(sum.value - 100) < 1e-9);

const save = useMutation({
  mutationFn: () =>
    apiRequest('/api/platform/scoring/weights', {
      method: 'PUT',
      body: { ...drafts },
    }),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['platform', 'scoring', 'weights'] });
    toast.success('Nieuw weegprofiel gepubliceerd');
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : 'Opslaan mislukt'),
});

const labels = Object.fromEntries(SCORE_COMPONENTS.map((c) => [c.key, c.labelNl]));
</script>

<template>
  <PlatformPageHeader
    title="Matches en scoring"
    description="Bewerkbare weegprofielen (som = 100). Bij opslaan wordt een nieuwe versie actief voor de worker."
  >
    <Tabs v-model="activeTab" :tabs="TABS" />

    <MwCard v-if="activeTab === 'weights'" title="Actief weegprofiel">
      <template #actions>
        <span class="text-xs text-text-muted">
          Actief: {{ weightsQuery.data.value?.active.id ?? '…' }}
        </span>
      </template>

      <MwBanner v-if="!valid" tone="warning" title="Som moet 100 zijn">
        Huidige som: {{ sum }}
      </MwBanner>

      <div class="mt-3 space-y-3">
        <label
          v-for="component in SCORE_COMPONENTS"
          :key="component.key"
          class="flex items-center justify-between gap-3 text-sm"
        >
          <span class="text-text">{{ labels[component.key] }}</span>
          <input
            v-model.number="drafts[component.key]"
            type="number"
            min="0"
            max="100"
            step="1"
            class="w-20 rounded-md border border-border bg-surface px-2 py-1.5 text-right tabular-nums"
          />
        </label>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3">
        <p class="text-xs text-text-muted">Som: {{ sum }} / 100</p>
        <MwButton variant="primary" :disabled="!valid" :loading="save.isPending.value" @click="save.mutate()">
          Publiceer nieuwe versie
        </MwButton>
      </div>
    </MwCard>

    <MwCard v-else>
      <EmptyState
        :dashed="false"
        title="Testlab nog niet beschikbaar"
        description="Handmatig twee merknamen scoreren volgt in een latere release."
      />
    </MwCard>
  </PlatformPageHeader>
</template>
