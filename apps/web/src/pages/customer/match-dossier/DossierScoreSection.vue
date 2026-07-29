<script setup lang="ts">
import { computed } from 'vue';
import DeadlineIndicator from '../../../components/DeadlineIndicator.vue';
import DisclaimerBanner from '../../../components/DisclaimerBanner.vue';
import { formatMatchScorePercent } from '../../../lib/format';
import { SCORE_COMPONENTS, SCORE_WEIGHT_PROFILE_ID } from '../../../lib/score-weights';
import type { TrademarkMatchRecord } from '../../../api/types';

const props = defineProps<{ match: TrademarkMatchRecord; daysRemaining: number | null }>();

/** Top four weighted components as a numbered timeline. */
const timeline = computed(() =>
  SCORE_COMPONENTS.filter((c) => c.key !== 'aiPlausibilityAdjustment').slice(0, 4).map((component, index) => ({
    step: index + 1,
    label: component.labelNl,
    weight: component.weight,
    value: props.match.scores[component.key],
    percent: Math.round(props.match.scores[component.key]),
  })),
);

const remainingBars = computed(() =>
  SCORE_COMPONENTS.filter((c) => c.key !== 'aiPlausibilityAdjustment').slice(4),
);
</script>

<template>
  <section class="space-y-4">
    <div class="grid gap-4 sm:grid-cols-[1fr_auto]">
      <div class="rounded-lg border border-border bg-surface p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Totaalscore</p>
        <p class="mt-2 text-4xl font-semibold tabular-nums text-text">
          {{ formatMatchScorePercent(match.totalScore) }}
        </p>
        <p class="mt-1 text-xs text-text-muted">Weegprofiel {{ SCORE_WEIGHT_PROFILE_ID }}</p>
      </div>
      <div class="rounded-lg border border-border bg-surface p-5 sm:min-w-[14rem]">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Oppositiedeadline</p>
        <div class="mt-3">
          <DeadlineIndicator
            :days-remaining="daysRemaining"
            :deadline-date="match.candidate.oppositionDeadline?.deadlineDate"
          />
        </div>
      </div>
    </div>

    <div class="rounded-lg border border-border bg-surface p-5">
      <h2 class="text-sm font-semibold text-text">Scoreoverzicht</h2>
      <ol class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li
          v-for="item in timeline"
          :key="item.step"
          class="rounded-md border border-border bg-surface-muted/40 p-4"
        >
          <div class="flex items-center gap-2">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong"
            >
              {{ item.step }}
            </span>
            <span class="text-xs font-medium text-text-muted">{{ item.weight }}% gewicht</span>
          </div>
          <p class="mt-3 text-sm font-medium text-text">{{ item.label }}</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-text">{{ item.percent }}%</p>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-border">
            <div
              class="h-full rounded-full bg-accent-strong"
              :style="{ width: `${Math.min(100, Math.max(0, item.percent))}%` }"
            />
          </div>
        </li>
      </ol>

      <div v-if="remainingBars.length" class="mt-5 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
        <div
          v-for="component in remainingBars"
          :key="component.key"
          class="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm"
        >
          <span class="text-text-muted">{{ component.labelNl }}</span>
          <span class="font-semibold tabular-nums text-text">
            {{ Math.round(match.scores[component.key]) }}%
          </span>
        </div>
      </div>

      <p class="mt-4 text-xs text-text-muted">
        AI-plausibiliteitscorrectie: {{ match.scores.aiPlausibilityAdjustment.toFixed(2) }} (gewicht 3%).
      </p>
      <div class="mt-4">
        <DisclaimerBanner />
      </div>
    </div>
  </section>
</template>
