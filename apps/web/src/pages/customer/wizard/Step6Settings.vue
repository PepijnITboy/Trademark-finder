<script setup lang="ts">
import { formatNiceClasses } from '../../../lib/format';

const props = defineProps<{ label: string; notes: string; niceClasses: readonly number[] }>();
const emit = defineEmits<{
  (e: 'update:label', value: string): void;
  (e: 'update:notes', value: string): void;
  (e: 'next'): void;
  (e: 'back'): void;
}>();

function submit(): void {
  if (props.label.trim().length === 0) return;
  emit('next');
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-base font-semibold text-text">Bewakingsinstellingen</h2>
      <p class="mt-1 text-sm text-text-muted">Geef dit bewaakte merk een herkenbare naam voor uw organisatie.</p>
    </div>

    <div class="space-y-4 rounded-lg border border-border bg-surface p-5">
      <div>
        <label for="watch-label" class="mb-1.5 block text-sm font-medium text-text">Interne naam</label>
        <input
          id="watch-label"
          :value="label"
          type="text"
          maxlength="300"
          class="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          @input="emit('update:label', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div>
        <label for="watch-notes" class="mb-1.5 block text-sm font-medium text-text">Notities (optioneel)</label>
        <textarea
          id="watch-notes"
          :value="notes"
          rows="3"
          maxlength="2000"
          class="w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          @input="emit('update:notes', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
      <div>
        <p class="mb-1.5 block text-sm font-medium text-text">Nice-klassen</p>
        <p class="text-sm text-text-muted">
          {{ formatNiceClasses(niceClasses) }} — overgenomen uit de officiële registratie en wordt gebruikt voor
          alle vergelijkingen.
        </p>
      </div>
      <div class="border-t border-border pt-4">
        <p class="mb-1.5 flex items-center gap-2 text-sm font-medium text-text">
          Score-drempel voor signalering
          <span class="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-muted">Binnenkort</span>
        </p>
        <input type="range" disabled class="w-full max-w-md accent-accent-strong opacity-50" />
        <p class="mt-1.5 text-xs text-text-muted">
          Per-merk drempelwaarden komen in een volgende fase beschikbaar. Momenteel gebruikt Merkwacht het
          standaard gewogen scoringsprofiel voor alle klassen.
        </p>
      </div>
    </div>

    <div class="flex justify-end gap-2 border-t border-border pt-4">
      <button type="button" class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted" @click="emit('back')">
        Terug
      </button>
      <button
        type="button"
        class="rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="label.trim().length === 0"
        @click="submit"
      >
        Volgende
      </button>
    </div>
  </div>
</template>
