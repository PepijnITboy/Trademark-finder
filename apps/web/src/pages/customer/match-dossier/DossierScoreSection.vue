<script setup lang="ts">
import { computed } from 'vue';
import DisclaimerBanner from '../../../components/DisclaimerBanner.vue';
import ScoreBar from '../../../components/ScoreBar.vue';
import { SCORE_COMPONENTS, SCORE_WEIGHT_PROFILE_ID } from '../../../lib/score-weights';
import type { TrademarkMatchRecord } from '../../../api/types';

const props = defineProps<{ match: TrademarkMatchRecord }>();

// aiPlausibilityAdjustment is a signed -1..1 correction, not a 0..1 similarity
// bar like the rest — it gets its own explanation in DossierAiExplanation.
const barComponents = computed(() => SCORE_COMPONENTS.filter((c) => c.key !== 'aiPlausibilityAdjustment'));
</script>

<template>
  <div class="rounded-lg border border-border bg-surface p-5">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-text">Scoreoverzicht</h2>
      <span class="text-xs text-text-muted">Weegprofiel {{ SCORE_WEIGHT_PROFILE_ID }}</span>
    </div>
    <div class="mt-4 space-y-3">
      <ScoreBar
        v-for="component in barComponents"
        :key="component.key"
        :label="component.labelNl"
        :value="match.scores[component.key]"
        :weight="component.weight"
      />
    </div>
    <p class="mt-3 text-xs text-text-muted">
      Daarnaast telt een AI-plausibiliteitscorrectie van {{ match.scores.aiPlausibilityAdjustment.toFixed(2) }} mee (gewicht 3%) —
      zie "Automatische contextanalyse" hieronder.
    </p>
    <div class="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
      <span class="font-medium text-text">Gewogen totaalscore</span>
      <span class="text-lg font-semibold tabular-nums text-text">{{ match.totalScore }} / 100</span>
    </div>
    <div class="mt-4">
      <DisclaimerBanner />
    </div>
  </div>
</template>
