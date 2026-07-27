<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    /** Normalized value in the 0..1 range. */
    value: number;
    /** Optional weight (0-100) shown alongside the label, e.g. from the scoring profile. */
    weight?: number;
    /** Compact variant omits the numeric percentage label. */
    compact?: boolean;
  }>(),
  { weight: undefined, compact: false },
);

const clamped = computed(() => Math.min(1, Math.max(0, props.value)));
const percentage = computed(() => Math.round(clamped.value * 100));

const tone = computed(() => {
  if (clamped.value >= 0.75) return 'bg-danger';
  if (clamped.value >= 0.5) return 'bg-warning';
  return 'bg-accent';
});
</script>

<template>
  <div class="flex items-center gap-3">
    <div class="flex w-40 shrink-0 items-baseline justify-between gap-2 text-xs text-text-muted">
      <span class="truncate">{{ label }}</span>
      <span v-if="weight !== undefined" class="shrink-0 tabular-nums">{{ weight }}%</span>
    </div>
    <div class="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted" role="progressbar" :aria-valuenow="percentage" aria-valuemin="0" aria-valuemax="100" :aria-label="label">
      <div class="h-full rounded-full transition-[width]" :class="tone" :style="{ width: `${percentage}%` }" />
    </div>
    <span v-if="!compact" class="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-text">{{ percentage }}%</span>
  </div>
</template>
