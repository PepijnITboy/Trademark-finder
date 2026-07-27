<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; dashed?: boolean }>(), {
  description: undefined,
  dashed: true,
});
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 rounded-lg border bg-surface px-6 py-12 text-center"
    :class="dashed ? 'border-dashed border-border' : 'border-border'"
  >
    <p class="text-sm font-medium text-text">{{ title }}</p>
    <p v-if="description" class="max-w-md text-sm text-text-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>
