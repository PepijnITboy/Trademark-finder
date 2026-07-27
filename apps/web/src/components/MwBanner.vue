<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'info' | 'success' | 'warning' | 'danger';
    title?: string;
    dismissible?: boolean;
  }>(),
  { tone: 'info', title: undefined, dismissible: false },
);

const emit = defineEmits<{ dismiss: [] }>();

const toneBorder: Record<string, string> = {
  info: 'border-info/25 bg-accent-soft/40',
  success: 'border-success/25 bg-success/5',
  warning: 'border-warning/30 bg-warning/5',
  danger: 'border-danger/30 bg-danger/5',
};
</script>

<template>
  <div class="flex gap-3 rounded-lg border px-4 py-3" :class="toneBorder[tone]" role="status">
    <div class="min-w-0 flex-1">
      <p v-if="title" class="text-sm font-semibold text-text">{{ title }}</p>
      <div class="text-sm text-text-muted" :class="title && 'mt-0.5'">
        <slot />
      </div>
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="shrink-0 rounded p-1 text-text-muted hover:bg-surface hover:text-text"
      aria-label="Sluiten"
      @click="emit('dismiss')"
    >
      <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>
