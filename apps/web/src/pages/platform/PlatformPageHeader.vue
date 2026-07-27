<script setup lang="ts">
import PageHeader from '../../components/PageHeader.vue';
import StatusBadge from '../../components/StatusBadge.vue';

defineProps<{ title: string; description?: string }>();
</script>

<template>
  <PageHeader :title="title" :description="description">
    <template #actions>
      <StatusBadge label="Platformbeheer" tone="accent" />
      <slot name="actions" />
    </template>
  </PageHeader>
</template>
