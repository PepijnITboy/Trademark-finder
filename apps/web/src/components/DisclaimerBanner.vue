<script setup lang="ts">
import { LEGAL_DISCLAIMER_NL } from '@merkwacht/domain';

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
</script>

<template>
  <div
    class="flex gap-3 rounded-md border border-border bg-surface-muted/60 px-4 py-3 text-xs leading-relaxed text-text-muted"
    :class="{ 'py-2': compact }"
    role="note"
  >
    <span class="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" aria-hidden="true" />
    <p>{{ LEGAL_DISCLAIMER_NL }}</p>
  </div>
</template>
