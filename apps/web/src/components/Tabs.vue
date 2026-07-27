<script setup lang="ts">
export interface TabItem {
  readonly key: string;
  readonly label: string;
}

defineProps<{ tabs: readonly TabItem[]; modelValue: string }>();
defineEmits<{ (e: 'update:modelValue', key: string): void }>();
</script>

<template>
  <div class="border-b border-border">
    <nav class="-mb-px flex gap-1 overflow-x-auto" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="modelValue === tab.key"
        class="shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        :class="
          modelValue === tab.key
            ? 'border-accent-strong text-accent-strong'
            : 'border-transparent text-text-muted hover:text-text'
        "
        @click="$emit('update:modelValue', tab.key)"
      >
        {{ tab.label }}
      </button>
    </nav>
  </div>
</template>
