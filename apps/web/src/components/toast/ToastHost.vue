<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useToastStore } from '../../stores/toast';

const toast = useToastStore();
const { items } = storeToRefs(toast);

const toneClass: Record<string, string> = {
  success: 'border-success/30 bg-surface text-text',
  error: 'border-danger/40 bg-surface text-text',
  info: 'border-info/30 bg-surface text-text',
  warning: 'border-warning/40 bg-surface text-text',
};

const toneDot: Record<string, string> = {
  success: 'bg-success',
  error: 'bg-danger',
  info: 'bg-info',
  warning: 'bg-warning',
};
</script>

<template>
  <div
    class="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    aria-live="polite"
    aria-relevant="additions"
  >
    <TransitionGroup name="mw-toast">
      <div
        v-for="item in items"
        :key="item.id"
        class="pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md"
        :class="toneClass[item.tone]"
        role="status"
      >
        <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="toneDot[item.tone]" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-sm text-text">{{ item.message }}</p>
          <button
            v-if="item.actionLabel && item.onAction"
            type="button"
            class="mt-1 text-sm font-medium text-accent-strong underline-offset-2 hover:underline"
            @click="item.onAction?.(); toast.dismiss(item.id)"
          >
            {{ item.actionLabel }}
          </button>
        </div>
        <button
          type="button"
          class="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          :aria-label="'Sluit melding'"
          @click="toast.dismiss(item.id)"
        >
          <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
