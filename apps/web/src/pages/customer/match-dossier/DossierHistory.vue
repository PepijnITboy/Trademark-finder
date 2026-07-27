<script setup lang="ts">
import { formatDateTime } from '../../../lib/format';
import type { TrademarkMatchRecord } from '../../../api/types';

defineProps<{ match: TrademarkMatchRecord }>();
</script>

<template>
  <div class="rounded-lg border border-border bg-surface p-5">
    <h2 class="text-sm font-semibold text-text">Interne geschiedenis</h2>

    <dl class="mt-3 grid grid-cols-1 gap-3 text-xs text-text-muted sm:grid-cols-3">
      <div>
        <dt class="uppercase tracking-wide">Gesignaleerd op</dt>
        <dd class="mt-0.5 text-text">{{ formatDateTime(match.createdAt) }}</dd>
      </div>
      <div>
        <dt class="uppercase tracking-wide">Laatst beoordeeld</dt>
        <dd class="mt-0.5 text-text">{{ match.reviewedAt ? formatDateTime(match.reviewedAt) : 'Nog niet beoordeeld' }}</dd>
      </div>
      <div>
        <dt class="uppercase tracking-wide">Adviseur ingeschakeld</dt>
        <dd class="mt-0.5 text-text">{{ match.advisorRequestedAt ? formatDateTime(match.advisorRequestedAt) : 'Nee' }}</dd>
      </div>
    </dl>

    <div class="mt-4 border-t border-border pt-4">
      <p class="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Notities</p>
      <ul v-if="match.notes.length > 0" class="space-y-3">
        <li v-for="note in [...match.notes].reverse()" :key="note.id" class="rounded-md bg-surface-muted/60 px-3 py-2">
          <p class="text-sm text-text">{{ note.note }}</p>
          <p class="mt-1 text-xs text-text-muted">{{ formatDateTime(note.createdAt) }}</p>
        </li>
      </ul>
      <p v-else class="text-sm text-text-muted">Nog geen interne notities toegevoegd.</p>
    </div>
  </div>
</template>
