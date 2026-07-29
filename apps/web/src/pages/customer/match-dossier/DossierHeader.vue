<script setup lang="ts">
import { isActiveMatchStatus } from '@merkwacht/domain';
import { computed } from 'vue';
import DeadlineIndicator from '../../../components/DeadlineIndicator.vue';
import StatusBadge from '../../../components/StatusBadge.vue';
import { MATCH_STATUS_LABELS_NL } from '../../../api/matches';
import { formatMatchScorePercent } from '../../../lib/format';
import { priorityFromScore } from '../../../lib/priority';
import type { TrademarkMatchRecord } from '../../../api/types';

const props = defineProps<{ match: TrademarkMatchRecord; daysRemaining: number | null; busy: boolean }>();
defineEmits<{
  (e: 'accept'): void;
  (e: 'reject'): void;
  (e: 'archive'): void;
  (e: 'mark-not-relevant'): void;
  (e: 'request-advisor'): void;
  (e: 'add-note'): void;
  (e: 'export', format: 'csv' | 'html' | 'pdf'): void;
}>();

const priority = priorityFromScore(props.match.totalScore);
const isNew = computed(() => props.match.status === 'new');
const isActive = computed(() => isActiveMatchStatus(props.match.status));
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
          <span class="text-text-muted font-normal">Eigenmerk</span>
          {{ match.watchedTrademarkLabel }}
          <span class="font-normal text-text-muted">· Match</span>
          {{ match.candidate.markText }}
        </h1>
        <div class="mt-1 flex items-center gap-3 text-sm">
          <span class="text-text-muted">Score</span>
          <span class="font-semibold tabular-nums text-text">{{ formatMatchScorePercent(match.totalScore) }}</span>
          <DeadlineIndicator
            :days-remaining="daysRemaining"
            :deadline-date="match.candidate.oppositionDeadline?.deadlineDate"
          />
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <div class="flex overflow-hidden rounded-md border border-border">
          <button type="button" class="px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-muted" @click="$emit('export', 'pdf')">
            Export PDF
          </button>
          <button type="button" class="border-l border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-muted" @click="$emit('export', 'csv')">
            CSV
          </button>
          <button type="button" class="border-l border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-muted" @click="$emit('export', 'html')">
            HTML
          </button>
        </div>
      </div>
    </div>

    <div v-if="isNew" class="flex flex-wrap gap-2 border-t border-border pt-4">
      <button
        type="button"
        class="rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy"
        @click="$emit('accept')"
      >
        Accepteren
      </button>
      <button
        type="button"
        class="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy"
        @click="$emit('reject')"
      >
        Niet relevant
      </button>
    </div>

    <div v-else-if="isActive" class="flex flex-wrap gap-2 border-t border-border pt-4">
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
        class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy"
        @click="$emit('mark-not-relevant')"
      >
        Niet relevant
      </button>
      <button
        type="button"
        class="rounded-md border border-danger px-3.5 py-2 text-sm font-medium text-danger hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy"
        @click="$emit('archive')"
      >
        Naar archief
      </button>
    </div>
  </div>
</template>
