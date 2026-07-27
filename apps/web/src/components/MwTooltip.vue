<script setup lang="ts">
withDefaults(
  defineProps<{
    text: string;
    placement?: 'top' | 'bottom';
  }>(),
  { placement: 'top' },
);
</script>

<template>
  <span class="group relative inline-flex items-center">
    <slot />
    <span
      role="tooltip"
      class="pointer-events-none absolute z-20 hidden max-w-xs rounded-md bg-accent-strong px-2.5 py-1.5 text-xs font-normal text-white shadow-md group-hover:block group-focus-within:block"
      :class="placement === 'top' ? 'bottom-full left-1/2 mb-1.5 -translate-x-1/2' : 'top-full left-1/2 mt-1.5 -translate-x-1/2'"
    >
      {{ text }}
    </span>
  </span>
</template>
