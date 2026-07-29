<script setup lang="ts">
import { computed } from 'vue';
import { formatDate, formatDaysRemaining } from '../lib/format';

const props = defineProps<{
  daysRemaining: number | null;
  deadlineDate?: string | null;
}>();

const urgency = computed<'danger' | 'warning' | 'success' | 'neutral' | 'passed'>(() => {
  const days = props.daysRemaining;
  if (days === null) return 'neutral';
  if (days < 0) return 'passed';
  if (days <= 3) return 'danger';
  if (days <= 14) return 'warning';
  return 'success';
});

const dotClasses: Record<string, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  success: 'bg-success',
  neutral: 'bg-text-muted',
  passed: 'bg-text-muted',
};

const textClasses: Record<string, string> = {
  danger: 'text-danger font-medium',
  warning: 'text-warning font-medium',
  success: 'text-success font-medium',
  neutral: 'text-text-muted',
  passed: 'text-text-muted line-through decoration-text-muted/60',
};

const absoluteLabel = computed(() => {
  if (!props.deadlineDate) return null;
  const formatted = formatDate(props.deadlineDate);
  return formatted === '—' ? null : formatted;
});
</script>

<template>
  <span class="inline-flex flex-col gap-0.5 text-xs" :class="textClasses[urgency]">
    <span class="inline-flex items-center gap-1.5">
      <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="dotClasses[urgency]" aria-hidden="true" />
      {{ formatDaysRemaining(daysRemaining) }}
    </span>
    <span v-if="absoluteLabel" class="pl-3 text-[11px] font-normal text-text-muted">
      {{ absoluteLabel }}
    </span>
  </span>
</template>
