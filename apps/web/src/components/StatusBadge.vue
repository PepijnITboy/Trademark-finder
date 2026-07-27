<script setup lang="ts">
import { computed } from 'vue';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const props = withDefaults(defineProps<{ label: string; tone?: BadgeTone }>(), { tone: 'neutral' });

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-text-muted border-border',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  info: 'bg-info/10 text-info border-info/30',
  accent: 'bg-accent-soft text-accent-strong border-accent/30',
};

const classes = computed(() => toneClasses[props.tone]);
</script>

<template>
  <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap" :class="classes">
    {{ label }}
  </span>
</template>
