<script setup lang="ts">
import { formatDate, formatNiceClasses } from '../../../lib/format';
import type { LookupCandidate } from '../../../api/types';

defineProps<{ candidate: LookupCandidate }>();
const emit = defineEmits<{ (e: 'next'): void; (e: 'back'): void }>();
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-base font-semibold text-text">Officiële gegevens</h2>
      <p class="mt-1 text-sm text-text-muted">Controleer of dit het juiste merk is voordat u doorgaat.</p>
    </div>

    <dl class="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Merktekst</dt>
        <dd class="mt-1 text-sm font-medium text-text">{{ candidate.markText }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Merktype</dt>
        <dd class="mt-1 text-sm text-text">{{ candidate.markType }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Merkhouder</dt>
        <dd class="mt-1 text-sm text-text">{{ candidate.applicantName }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Registratiestatus</dt>
        <dd class="mt-1 text-sm text-text">{{ candidate.registerStatus }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Nice-klassen</dt>
        <dd class="mt-1 text-sm text-text">{{ formatNiceClasses(candidate.niceClasses) }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Aanvraagdatum</dt>
        <dd class="mt-1 text-sm text-text">{{ formatDate(candidate.filingDate) }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Registratiedatum</dt>
        <dd class="mt-1 text-sm text-text">{{ formatDate(candidate.registrationDate) }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Register</dt>
        <dd class="mt-1 text-sm text-text">{{ candidate.registryCode }} · {{ candidate.registrationNumber }}</dd>
      </div>
    </dl>

    <div class="flex justify-end gap-2 border-t border-border pt-4">
      <button type="button" class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted" @click="emit('back')">
        Terug
      </button>
      <button type="button" class="rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white hover:bg-accent" @click="emit('next')">
        Volgende
      </button>
    </div>
  </div>
</template>
