<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string }>(), { description: undefined });
</script>

<template>
  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0">
      <h1 class="text-xl font-semibold text-text">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-2xl text-sm text-text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
