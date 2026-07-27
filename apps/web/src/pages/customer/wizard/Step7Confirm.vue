<script setup lang="ts">
import { formatNiceClasses } from '../../../lib/format';
import type { LookupCandidate } from '../../../api/types';

defineProps<{
  candidate: LookupCandidate;
  label: string;
  notes: string;
  submitting: boolean;
  errorMessage: string | null;
}>();
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'back'): void }>();
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-base font-semibold text-text">Bevestig toevoeging</h2>
      <p class="mt-1 text-sm text-text-muted">
        Controleer de gegevens. Na bevestiging start Merkwacht bewaking van
        <span class="font-medium text-text">het bewaakte oudere merk</span>.
      </p>
    </div>

    <dl class="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Interne naam</dt>
        <dd class="mt-1 text-sm font-medium text-text">{{ label }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Merktekst</dt>
        <dd class="mt-1 text-sm text-text">{{ candidate.markText }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Register</dt>
        <dd class="mt-1 text-sm text-text">{{ candidate.registryCode }} · {{ candidate.registrationNumber }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Nice-klassen</dt>
        <dd class="mt-1 text-sm text-text">{{ formatNiceClasses(candidate.niceClasses) }}</dd>
      </div>
      <div v-if="notes" class="sm:col-span-2">
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Notities</dt>
        <dd class="mt-1 text-sm text-text">{{ notes }}</dd>
      </div>
    </dl>

    <p v-if="errorMessage" class="text-sm text-danger">{{ errorMessage }}</p>

    <div class="flex justify-end gap-2 border-t border-border pt-4">
      <button
        type="button"
        class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted"
        :disabled="submitting"
        @click="emit('back')"
      >
        Terug
      </button>
      <button
        type="button"
        class="rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="submitting"
        @click="emit('confirm')"
      >
        {{ submitting ? 'Bezig met toevoegen…' : 'Merk toevoegen' }}
      </button>
    </div>
  </div>
</template>
