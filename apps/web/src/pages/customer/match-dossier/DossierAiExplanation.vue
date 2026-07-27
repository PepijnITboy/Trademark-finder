<script setup lang="ts">
import { computed } from 'vue';
import type { TrademarkMatchRecord } from '../../../api/types';

const props = defineProps<{ match: TrademarkMatchRecord }>();

const adjustment = computed(() => props.match.scores.aiPlausibilityAdjustment);
const direction = computed<'up' | 'down' | 'none'>(() => {
  if (adjustment.value > 0) return 'up';
  if (adjustment.value < 0) return 'down';
  return 'none';
});
</script>

<template>
  <div class="rounded-lg border border-border bg-surface p-5">
    <h2 class="text-sm font-semibold text-text">Automatische contextanalyse</h2>
    <p class="mt-1 text-sm text-text-muted">
      Een aanvullende, geautomatiseerde correctie die de tekstuele/fonetische score bijstelt op basis van bredere
      context (bijvoorbeeld gangbaarheid van de term). Dit is geen menselijke of juridische beoordeling.
    </p>
    <div class="mt-4 flex items-center gap-3 rounded-md bg-surface-muted/60 px-4 py-3">
      <span
        class="text-lg font-semibold tabular-nums"
        :class="{ 'text-danger': direction === 'up', 'text-success': direction === 'down', 'text-text-muted': direction === 'none' }"
      >
        {{ adjustment > 0 ? '+' : '' }}{{ adjustment.toFixed(2) }}
      </span>
      <p class="text-xs text-text-muted">
        <span v-if="direction === 'up'">Deze correctie verhoogt de totaalscore licht.</span>
        <span v-else-if="direction === 'down'">Deze correctie verlaagt de totaalscore licht.</span>
        <span v-else>Er is geen bijstelling toegepast op deze match.</span>
      </p>
    </div>
    <p class="mt-3 text-xs text-text-muted">
      Een tekstuele toelichting per individuele match is nog niet beschikbaar; deze sectie toont uitsluitend de
      berekende correctiewaarde.
    </p>
  </div>
</template>
