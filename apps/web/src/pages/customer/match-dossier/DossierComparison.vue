<script setup lang="ts">
import { formatDate, formatNiceClasses } from '../../../lib/format';
import type { TrademarkMatchRecord, WatchedTrademarkRecord } from '../../../api/types';

defineProps<{ watched: WatchedTrademarkRecord | undefined; match: TrademarkMatchRecord }>();
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="rounded-lg border border-border bg-surface p-5">
      <p class="text-xs font-semibold uppercase tracking-wide text-accent-strong">Eigenmerk</p>
      <p class="mt-2 text-lg font-semibold text-text">{{ match.watchedTrademarkLabel }}</p>
      <p v-if="watched" class="text-sm text-text-muted">{{ watched.markText }}</p>
      <dl class="mt-4 space-y-2 text-sm">
        <div class="flex justify-between gap-2">
          <dt class="text-text-muted">Register</dt>
          <dd class="text-text">{{ watched?.registryCode ?? '—' }} · {{ watched?.registrationNumber ?? '—' }}</dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-text-muted">Nice-klassen</dt>
          <dd class="text-text">{{ watched ? formatNiceClasses(watched.niceClasses) : '—' }}</dd>
        </div>
      </dl>
    </div>

    <div class="rounded-lg border border-border bg-surface p-5">
      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Match gevonden</p>
      <p class="mt-2 text-lg font-semibold text-text">{{ match.candidate.markText }}</p>
      <p class="text-sm text-text-muted">{{ match.candidate.applicantName }}</p>
      <dl class="mt-4 space-y-2 text-sm">
        <div class="flex justify-between gap-2">
          <dt class="text-text-muted">Register</dt>
          <dd class="text-text">{{ match.candidate.registryCode }} · {{ match.candidate.applicationNumber }}</dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-text-muted">Nice-klassen</dt>
          <dd class="text-text">{{ formatNiceClasses(match.candidate.niceClasses) }}</dd>
        </div>
        <div class="flex justify-between gap-2">
          <dt class="text-text-muted">Publicatiedatum</dt>
          <dd class="text-text">{{ formatDate(match.candidate.publicationDate) }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>
