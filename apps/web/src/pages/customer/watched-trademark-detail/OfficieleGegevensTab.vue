<script setup lang="ts">
import { formatDateTime, formatNiceClasses } from '../../../lib/format';
import type { WatchedTrademarkRecord } from '../../../api/types';

defineProps<{ watched: WatchedTrademarkRecord }>();
</script>

<template>
  <div class="max-w-2xl space-y-4">
    <p class="text-sm text-text-muted">
      Gegevens zoals vastgelegd op het moment van toevoegen aan Merkwacht, afkomstig uit de officiële
      registerbron.
    </p>
    <dl class="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Merktekst</dt>
        <dd class="mt-1 text-sm text-text">{{ watched.markText }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Register</dt>
        <dd class="mt-1 text-sm text-text">{{ watched.registryCode }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Depotnummer</dt>
        <dd class="mt-1 text-sm text-text">{{ watched.registrationNumber }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Nice-klassen</dt>
        <dd class="mt-1 text-sm text-text">{{ formatNiceClasses(watched.niceClasses) }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Registratiestatus bij beoordeling</dt>
        <dd class="mt-1 text-sm text-text">{{ watched.eligibility.sourceStatus ?? 'Onbekend' }}</dd>
      </div>
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-muted">Laatst beoordeeld op</dt>
        <dd class="mt-1 text-sm text-text">{{ formatDateTime(watched.eligibility.evaluatedAt) }}</dd>
      </div>
    </dl>
  </div>
</template>
