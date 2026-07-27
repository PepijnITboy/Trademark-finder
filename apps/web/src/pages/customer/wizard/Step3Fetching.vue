<script setup lang="ts">
defineProps<{ registrationNumber: string }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 py-16 text-center">
    <span class="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent-strong" aria-hidden="true" />
    <div>
      <p class="text-sm font-medium text-text">Officiële gegevens worden opgehaald…</p>
      <p class="mt-1 text-xs text-text-muted">Registratienummer {{ registrationNumber }}</p>
    </div>
  </div>
</template>
