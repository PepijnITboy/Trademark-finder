<script setup lang="ts">
import { computed } from 'vue';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const props = withDefaults(defineProps<{ label: string; tone?: BadgeTone }>(), { tone: 'neutral' });

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-text-muted border-border',
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/10 text-warning border-warning/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  info: 'bg-info/10 text-info border-info/25',
  accent: 'bg-accent-soft text-accent-strong border-accent/20',
};

const classes = computed(() => toneClasses[props.tone]);
</script>

<template>
  <span
    class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
    :class="classes"
  >
    {{ label }}
  </span>
</template>
