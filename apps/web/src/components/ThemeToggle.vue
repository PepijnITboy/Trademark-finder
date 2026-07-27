<script setup lang="ts">
import { useThemeStore, type ThemeMode } from '../stores/theme';

const themeStore = useThemeStore();

const options: Array<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: 'Licht' },
  { value: 'dark', label: 'Donker' },
  { value: 'system', label: 'Systeem' },
];
</script>

<template>
  <div class="flex overflow-hidden rounded-md border border-border text-xs" role="group" aria-label="Thema">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="flex-1 px-2 py-1.5 transition-colors"
      :class="
        themeStore.mode === option.value
          ? 'bg-accent-soft font-medium text-accent-strong'
          : 'text-text-muted hover:bg-surface-muted'
      "
      :aria-label="`${option.label} thema`"
      :aria-pressed="themeStore.mode === option.value"
      @click="themeStore.setMode(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
