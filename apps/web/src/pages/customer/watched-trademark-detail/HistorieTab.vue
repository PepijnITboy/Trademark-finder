<script setup lang="ts">
import { computed } from 'vue';
import { formatDateTime } from '../../../lib/format';
import type { TrademarkMatchRecord, WatchedTrademarkRecord } from '../../../api/types';

const props = defineProps<{ watched: WatchedTrademarkRecord; matches: readonly TrademarkMatchRecord[] }>();

interface HistoryEntry {
  readonly at: string;
  readonly labelNl: string;
  readonly detailNl: string;
}

const entries = computed<readonly HistoryEntry[]>(() => {
  const items: HistoryEntry[] = [
    { at: props.watched.createdAt, labelNl: 'Merk toegevoegd', detailNl: `${props.watched.markText} toegevoegd aan Merkwacht.` },
  ];
  if (props.watched.updatedAt !== props.watched.createdAt) {
    items.push({ at: props.watched.updatedAt, labelNl: 'Instellingen bijgewerkt', detailNl: 'De bewakingsinstellingen zijn gewijzigd.' });
  }
  for (const match of props.matches) {
    items.push({
      at: match.createdAt,
      labelNl: 'Nieuwe match gesignaleerd',
      detailNl: `${match.candidate.markText} (score ${match.totalScore}) gedetecteerd bij ${match.candidate.registryCode}.`,
    });
    if (match.reviewedAt) {
      items.push({
        at: match.reviewedAt,
        labelNl: 'Match beoordeeld',
        detailNl: `${match.candidate.markText} gemarkeerd als "${match.status}".`,
      });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
});
</script>

<template>
  <div class="max-w-2xl">
    <p class="mb-4 text-sm text-text-muted">
      Overzicht van matchactiviteit voor dit merk. Dit is geen volledig auditlog van alle systeemhandelingen.
    </p>
    <ol v-if="entries.length > 0" class="space-y-4 border-l border-border pl-4">
      <li v-for="(entry, index) in entries" :key="`${entry.at}-${index}`" class="relative">
        <span class="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
        <p class="text-xs text-text-muted">{{ formatDateTime(entry.at) }}</p>
        <p class="text-sm font-medium text-text">{{ entry.labelNl }}</p>
        <p class="text-sm text-text-muted">{{ entry.detailNl }}</p>
      </li>
    </ol>
    <p v-else class="text-sm text-text-muted">Nog geen activiteit geregistreerd.</p>
  </div>
</template>
