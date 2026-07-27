<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    padding?: boolean;
  }>(),
  { title: undefined, padding: true },
);
</script>

<template>
  <section class="rounded-lg border border-border bg-surface shadow-sm">
    <div
      v-if="title || $slots.header || $slots.actions"
      class="flex items-start justify-between gap-3 border-b border-border px-5 py-4"
    >
      <div class="min-w-0">
        <h2 v-if="title" class="text-base font-semibold text-text">{{ title }}</h2>
        <slot name="header" />
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div :class="padding ? 'px-5 py-5' : ''">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-border px-5 py-3">
      <slot name="footer" />
    </div>
  </section>
</template>
