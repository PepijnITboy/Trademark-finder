<script setup lang="ts">
defineProps<{ current: number; labels: readonly string[] }>();
</script>

<template>
  <ol class="flex flex-wrap items-center gap-x-2 gap-y-3 text-xs">
    <li v-for="(label, index) in labels" :key="label" class="flex items-center gap-2">
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
        :class="
          index + 1 < current
            ? 'border-accent-strong bg-accent-strong text-white'
            : index + 1 === current
              ? 'border-accent-strong text-accent-strong'
              : 'border-border text-text-muted'
        "
      >
        {{ index + 1 }}
      </span>
      <span :class="index + 1 === current ? 'font-medium text-text' : 'text-text-muted'">{{ label }}</span>
      <span v-if="index < labels.length - 1" class="mx-1 h-px w-4 bg-border" aria-hidden="true" />
    </li>
  </ol>
</template>
