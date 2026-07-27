<script setup lang="ts">
import MwPage from '../../components/MwPage.vue';

defineProps<{ title: string; description?: string }>();
</script>

<template>
  <MwPage :title="title" :description="description">
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <slot />
  </MwPage>
</template>
