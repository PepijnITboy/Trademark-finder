<script setup lang="ts">
import { computed } from 'vue';
import { formatDate } from '../../../lib/format';
import type { TrademarkMatchRecord } from '../../../api/types';

const props = defineProps<{ match: TrademarkMatchRecord }>();

interface TimelineEvent {
  readonly date: string | null;
  readonly labelNl: string;
}

const events = computed<readonly TimelineEvent[]>(() => {
  const { candidate } = props.match;
  const list: TimelineEvent[] = [
    { date: candidate.filingDate, labelNl: 'Aanvraag ingediend' },
    { date: candidate.publicationDate, labelNl: 'Publicatie in register' },
  ];
  if (candidate.oppositionDeadline) {
    list.push({ date: candidate.oppositionDeadline.startDate, labelNl: 'Start oppositietermijn' });
    list.push({ date: candidate.oppositionDeadline.deadlineDate, labelNl: 'Uiterste datum oppositie' });
  }
  return list.filter((e) => e.date !== null).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
});
</script>

<template>
  <div class="rounded-lg border border-border bg-surface p-5">
    <h2 class="text-sm font-semibold text-text">Procedureel tijdlijn</h2>
    <p class="mt-1 text-xs text-text-muted">Procedurele status: {{ match.candidate.proceduralStatus }}</p>
    <ol class="mt-4 flex flex-wrap gap-x-6 gap-y-3">
      <li v-for="(event, index) in events" :key="event.labelNl" class="flex items-center gap-2">
        <span class="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-text-muted">{{ index + 1 }}</span>
        <span class="text-sm">
          <span class="block font-medium text-text">{{ formatDate(event.date) }}</span>
          <span class="text-xs text-text-muted">{{ event.labelNl }}</span>
        </span>
      </li>
    </ol>
  </div>
</template>
