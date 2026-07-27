<script setup lang="ts">
/** Filter bar container for index pages (search + selects). */
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 shadow-sm">
    <slot />
    <div v-if="$slots.meta" class="ml-auto text-xs text-text-muted">
      <slot name="meta" />
    </div>
  </div>
</template>
