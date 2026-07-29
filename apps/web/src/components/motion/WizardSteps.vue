<script setup lang="ts">
defineProps<{ current: number; labels: readonly string[] }>();
</script>

<template>
  <ol class="mw-wizard-steps flex flex-wrap items-center gap-x-1 gap-y-3 text-xs" aria-label="Stappen">
    <li
      v-for="(label, index) in labels"
      :key="label"
      class="flex items-center gap-2"
      :aria-current="index + 1 === current ? 'step' : undefined"
    >
      <span
        class="mw-wizard-dot relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[11px] font-semibold"
        :class="
          index + 1 < current
            ? 'mw-wizard-dot--done border-success bg-success text-white'
            : index + 1 === current
              ? 'mw-wizard-dot--current border-accent-strong text-accent-strong'
              : 'border-border text-text-muted'
        "
      >
        <span
          v-if="index + 1 < current"
          class="mw-wizard-dot-fill absolute inset-0 bg-success"
          aria-hidden="true"
        />
        <span class="relative z-[1]">
          <template v-if="index + 1 < current">✓</template>
          <template v-else>{{ index + 1 }}</template>
        </span>
      </span>
      <span :class="index + 1 === current ? 'font-medium text-text' : 'text-text-muted'">{{ label }}</span>
      <span
        v-if="index < labels.length - 1"
        class="mw-wizard-connector mx-1 h-0.5 w-6 overflow-hidden rounded-full bg-border"
        aria-hidden="true"
      >
        <span
          class="mw-wizard-connector-fill block h-full origin-left bg-success transition-transform duration-300 ease-out"
          :class="index + 1 < current ? 'scale-x-100' : 'scale-x-0'"
        />
      </span>
    </li>
  </ol>
</template>
