<script setup lang="ts">
import DeadlineIndicator from '../../../components/DeadlineIndicator.vue';
import StatusBadge from '../../../components/StatusBadge.vue';
import { MATCH_STATUS_LABELS_NL } from '../../../api/matches';
import { priorityFromScore } from '../../../lib/priority';
import type { TrademarkMatchRecord } from '../../../api/types';

const props = defineProps<{ match: TrademarkMatchRecord; daysRemaining: number | null; busy: boolean }>();
defineEmits<{
  (e: 'mark-relevant'): void;
  (e: 'mark-not-relevant'): void;
  (e: 'request-advisor'): void;
  (e: 'add-note'): void;
  (e: 'complete'): void;
  (e: 'export', format: 'csv' | 'html'): void;
}>();

const priority = priorityFromScore(props.match.totalScore);
</script>

<template>
  <div class="space-y-4 rounded-lg border border-border bg-surface p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge :label="priority.labelNl" :tone="priority.tone" />
          <StatusBadge :label="MATCH_STATUS_LABELS_NL[match.status]" tone="accent" />
        </div>
        <h1 class="mt-2 text-xl font-semibold text-text">
          {{ match.candidate.markText }} <span class="font-normal text-text-muted">vs.</span> {{ match.watchedTrademarkLabel }}
        </h1>
        <div class="mt-1 flex items-center gap-3 text-sm">
          <span class="text-text-muted">Totaalscore</span>
          <span class="font-semibold tabular-nums text-text">{{ match.totalScore }} / 100</span>
          <DeadlineIndicator :days-remaining="daysRemaining" />
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <div class="flex overflow-hidden rounded-md border border-border">
          <button type="button" class="px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-muted" @click="$emit('export', 'csv')">
            Export CSV
          </button>
          <button type="button" class="border-l border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-muted" @click="$emit('export', 'html')">
            Export HTML
          </button>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 border-t border-border pt-4">
      <button
        type="button"
        class="rounded-md bg-success px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy"
        @click="$emit('mark-relevant')"
      >
        Relevant
      </button>
      <button
        type="button"
        class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy"
        @click="$emit('mark-not-relevant')"
      >
        Niet relevant
      </button>
      <button
        type="button"
        class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy || match.advisorRequestedAt !== null"
        @click="$emit('request-advisor')"
      >
        {{ match.advisorRequestedAt ? 'Adviseur ingeschakeld' : 'Adviseur inschakelen' }}
      </button>
      <button
        type="button"
        class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy"
        @click="$emit('add-note')"
      >
        Notitie toevoegen
      </button>
      <button
        type="button"
        class="ml-auto rounded-md border border-accent-strong px-3.5 py-2 text-sm font-medium text-accent-strong hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy"
        @click="$emit('complete')"
      >
        Afronden
      </button>
    </div>
  </div>
</template>
