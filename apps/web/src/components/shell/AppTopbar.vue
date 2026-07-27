<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    badge?: string;
  }>(),
  { badge: undefined },
);
</script>

<template>
  <header
    v-if="label || badge || $slots.actions"
    class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6"
  >
    <div class="flex items-center gap-3">
      <p v-if="label" class="text-sm text-text-muted">{{ label }}</p>
      <span
        v-if="badge"
        class="inline-flex rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-strong"
      >
        {{ badge }}
      </span>
    </div>
    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
