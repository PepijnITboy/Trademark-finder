<script setup lang="ts">
import { computed } from 'vue';
import { resolveProtectionDisplay } from '@merkwacht/domain';
import StatusBadge from '../../../components/StatusBadge.vue';
import { WATCHED_TRADEMARK_STATUS_LABELS_NL } from '../../../api/watched-trademarks';
import { formatDate, formatNiceClasses } from '../../../lib/format';
import { priorityFromScore } from '../../../lib/priority';
import type { TrademarkMatchRecord, WatchedTrademarkRecord } from '../../../api/types';

const props = defineProps<{ watched: WatchedTrademarkRecord; matches: readonly TrademarkMatchRecord[] }>();

const protection = computed(() =>
  resolveProtectionDisplay({
    status: props.watched.status,
    eligibility: props.watched.eligibility,
    registerMonitoringOk: props.watched.registerMonitoringOk ?? false,
  }),
);

const activeMatches = computed(() => props.matches.filter((m) => m.status === 'new' || m.status === 'under_review'));
const highPriorityCount = computed(
  () => props.matches.filter((m) => priorityFromScore(m.totalScore).level === 'high').length,
);
const nextDeadline = computed(() => {
  const dated = props.matches
    .map((m) => m.candidate.oppositionDeadline)
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate));
  return dated[0] ?? null;
});
</script>

<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <div class="space-y-4 lg:col-span-2">
      <div class="rounded-lg border border-border bg-surface p-5">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge
            :label="WATCHED_TRADEMARK_STATUS_LABELS_NL[watched.status]"
            :tone="watched.status === 'active' ? 'success' : 'neutral'"
          />
          <StatusBadge :label="protection.labelNl" :tone="protection.tone" />
        </div>
        <p class="mt-2 text-sm text-text-muted">{{ protection.detailNl }}</p>
        <dl class="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-xs uppercase tracking-wide text-text-muted">Merktekst</dt>
            <dd class="mt-0.5 text-text">{{ watched.markText }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-text-muted">Register</dt>
            <dd class="mt-0.5 text-text">{{ watched.registryCode }} · {{ watched.registrationNumber }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-text-muted">Nice-klassen</dt>
            <dd class="mt-0.5 text-text">{{ formatNiceClasses(watched.niceClasses) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-text-muted">Toegevoegd op</dt>
            <dd class="mt-0.5 text-text">{{ formatDate(watched.createdAt) }}</dd>
          </div>
        </dl>
        <p v-if="watched.notes" class="mt-4 border-t border-border pt-4 text-sm text-text-muted">{{ watched.notes }}</p>
      </div>
    </div>
    <div class="space-y-4">
      <div class="rounded-lg border border-border bg-surface p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Actieve matches</p>
        <p class="mt-1 text-2xl font-semibold text-text">{{ activeMatches.length }}</p>
      </div>
      <div class="rounded-lg border border-border bg-surface p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Hoge prioriteit</p>
        <p class="mt-1 text-2xl font-semibold" :class="highPriorityCount > 0 ? 'text-danger' : 'text-text'">
          {{ highPriorityCount }}
        </p>
      </div>
      <div class="rounded-lg border border-border bg-surface p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Eerstvolgende oppositiedeadline</p>
        <p class="mt-1 text-sm font-medium text-text">
          {{ nextDeadline ? formatDate(nextDeadline.deadlineDate) : 'Geen openstaande deadline' }}
        </p>
      </div>
    </div>
  </div>
</template>
