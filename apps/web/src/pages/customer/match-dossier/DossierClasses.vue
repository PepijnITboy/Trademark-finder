<script setup lang="ts">
import { computed } from 'vue';
import ScoreBar from '../../../components/ScoreBar.vue';
import type { TrademarkMatchRecord, WatchedTrademarkRecord } from '../../../api/types';

const props = defineProps<{ watched: WatchedTrademarkRecord | undefined; match: TrademarkMatchRecord }>();

const watchedClasses = computed(() => new Set(props.watched?.niceClasses ?? []));
const sharedClasses = computed(() => props.match.candidate.niceClasses.filter((c) => watchedClasses.value.has(c)));
</script>

<template>
  <div class="rounded-lg border border-border bg-surface p-5">
    <h2 class="text-sm font-semibold text-text">Klassen en waren/diensten</h2>
    <div class="mt-4 flex flex-wrap gap-1.5">
      <span
        v-for="niceClass in match.candidate.niceClasses"
        :key="niceClass"
        class="inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium tabular-nums"
        :class="
          sharedClasses.includes(niceClass)
            ? 'border-accent-strong bg-accent-soft text-accent-strong'
            : 'border-border text-text-muted'
        "
        :title="sharedClasses.includes(niceClass) ? 'Ook geregistreerd bij het bewaakte merk' : 'Alleen bij de kandidaat-aanvraag'"
      >
        {{ niceClass }}
      </span>
    </div>
    <p class="mt-2 text-xs text-text-muted">
      {{ sharedClasses.length }} van {{ match.candidate.niceClasses.length }} klassen komen overeen met het bewaakte merk.
      Gearceerde klassen zijn gedeeld.
    </p>
    <div class="mt-4 space-y-3 border-t border-border pt-4">
      <ScoreBar label="Overlap Nice-klassen" :value="match.scores.niceClassOverlap" />
      <ScoreBar label="Overlap waren en diensten" :value="match.scores.goodsServicesOverlap" />
    </div>
    <p class="mt-3 text-xs text-text-muted">
      Merkwacht vergelijkt momenteel op klasseniveau; een gedetailleerde tekstuele vergelijking van waren- en
      dienstenomschrijvingen is nog niet beschikbaar.
    </p>
  </div>
</template>
