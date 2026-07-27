<script setup lang="ts">
withDefaults(
  defineProps<{ label: string; value: string | number; hint?: string; loading?: boolean; tone?: 'neutral' | 'danger' | 'warning' }>(),
  { hint: undefined, loading: false, tone: 'neutral' },
);
</script>

<template>
  <div class="rounded-lg border border-border bg-surface p-4 shadow-sm">
    <p class="text-xs font-medium text-text-muted">{{ label }}</p>
    <div v-if="loading" class="mt-2 h-8 w-16 animate-pulse rounded bg-surface-muted" />
    <p
      v-else
      class="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight"
      :class="{ 'text-danger': tone === 'danger', 'text-warning': tone === 'warning', 'text-text': tone === 'neutral' }"
    >
      {{ value }}
    </p>
    <p v-if="hint && !loading" class="mt-1 text-xs text-text-muted">{{ hint }}</p>
  </div>
</template>
