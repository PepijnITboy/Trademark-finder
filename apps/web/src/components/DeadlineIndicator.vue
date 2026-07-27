<script setup lang="ts">
import { computed } from 'vue';
import { formatDaysRemaining } from '../lib/format';

const props = defineProps<{ daysRemaining: number | null }>();

const urgency = computed<'danger' | 'warning' | 'neutral' | 'passed'>(() => {
  const days = props.daysRemaining;
  if (days === null) return 'neutral';
  if (days < 0) return 'passed';
  if (days <= 3) return 'danger';
  if (days <= 14) return 'warning';
  return 'neutral';
});

const dotClasses: Record<string, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  neutral: 'bg-text-muted',
  passed: 'bg-text-muted',
};

const textClasses: Record<string, string> = {
  danger: 'text-danger font-medium',
  warning: 'text-warning font-medium',
  neutral: 'text-text-muted',
  passed: 'text-text-muted line-through decoration-text-muted/60',
};
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-xs" :class="textClasses[urgency]">
    <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="dotClasses[urgency]" aria-hidden="true" />
    {{ formatDaysRemaining(daysRemaining) }}
  </span>
</template>
