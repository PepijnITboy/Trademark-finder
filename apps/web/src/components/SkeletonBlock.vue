<script setup lang="ts">
withDefaults(defineProps<{ height?: string; width?: string }>(), { height: '1rem', width: '100%' });
</script>

<template>
  <div class="animate-pulse rounded bg-surface-muted" :style="{ height, width }" />
</template>
