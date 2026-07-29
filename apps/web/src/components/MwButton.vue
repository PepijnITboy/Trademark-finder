<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'plain';
    size?: 'sm' | 'md';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
    disabled: false,
    loading: false,
    block: false,
  },
);
</script>

<template>
  <button
    :type="type"
    class="mw-btn-press inline-flex items-center justify-center gap-2 rounded-md font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-3.5 py-2 text-sm',
      block && 'w-full',
      variant === 'primary' && 'bg-accent-strong text-white hover:bg-accent',
      variant === 'secondary' && 'border border-border bg-surface text-text shadow-sm hover:bg-surface-muted',
      variant === 'tertiary' && 'bg-transparent text-text-muted hover:bg-surface-muted hover:text-text',
      variant === 'danger' && 'bg-danger text-white hover:opacity-90',
      variant === 'plain' && 'bg-transparent text-accent-strong hover:underline',
    ]"
    :disabled="disabled || loading"
  >
    <svg
      v-if="loading"
      class="h-4 w-4 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <slot />
  </button>
</template>
