<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    forId?: string;
  }>(),
  { hint: undefined, error: undefined, required: false, forId: undefined },
);
</script>

<template>
  <div class="space-y-1.5">
    <label :for="forId" class="block text-sm font-medium text-text">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>
    <slot />
    <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-text-muted">{{ hint }}</p>
  </div>
</template>
