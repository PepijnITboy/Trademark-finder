<script setup lang="ts">
import { watch } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'neutral' | 'danger';
    confirmDisabled?: boolean;
    busy?: boolean;
  }>(),
  {
    description: undefined,
    confirmLabel: 'Bevestigen',
    cancelLabel: 'Annuleren',
    tone: 'neutral',
    confirmDisabled: false,
    busy: false,
  },
);

const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>();

watch(
  () => props.open,
  (isOpen) => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },
);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div class="absolute inset-0 bg-black/40" @click="emit('cancel')" />
      <div
        class="relative w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-md"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <h2 class="text-base font-semibold text-text">{{ title }}</h2>
        <p v-if="description" class="mt-2 text-sm text-text-muted">{{ description }}</p>
        <div v-if="$slots.default" class="mt-4">
          <slot />
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            @click="emit('cancel')"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-2 text-sm font-medium text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            :class="
              tone === 'danger'
                ? 'bg-danger hover:bg-danger/90 focus-visible:outline-danger'
                : 'bg-accent-strong hover:bg-accent focus-visible:outline-accent-strong'
            "
            :disabled="confirmDisabled || busy"
            @click="emit('confirm')"
          >
            {{ busy ? 'Bezig…' : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
