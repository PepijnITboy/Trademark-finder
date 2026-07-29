<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import DeadlineIndicator from '../../components/DeadlineIndicator.vue';
import EmptyState from '../../components/EmptyState.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import { useDeadlines } from '../../api/deadlines';
import { formatDate, formatMatchScorePercent } from '../../lib/format';
import { deadlineBucketKey, deadlineBucketsInOrder } from '../../lib/priority';
import type { DeadlineEntry } from '../../api/types';
import { useMatches } from '../../api/matches';

const router = useRouter();
const deadlinesQuery = useDeadlines();
const activeMatchesQuery = useMatches(computed(() => ({ queue: 'active' as const })));
const possibleMatchesQuery = useMatches(computed(() => ({ queue: 'possible' as const })));

const scoreByMatchId = computed(() => {
  const map = new Map<string, number>();
  for (const match of [...(activeMatchesQuery.data.value ?? []), ...(possibleMatchesQuery.data.value ?? [])]) {
    map.set(match.id, match.totalScore);
  }
  return map;
});

const grouped = computed(() => {
  const buckets = new Map<string, DeadlineEntry[]>();
  for (const entry of deadlinesQuery.data.value ?? []) {
    const key = deadlineBucketKey(entry.daysRemaining);
    const list = buckets.get(key) ?? [];
    list.push(entry);
    buckets.set(key, list);
  }
  return deadlineBucketsInOrder()
    .map((bucket) => ({ ...bucket, entries: buckets.get(bucket.key) ?? [] }))
    .filter((bucket) => bucket.entries.length > 0);
});

function goToMatch(matchId: string): void {
  void router.push({ name: 'app-match-detail', params: { id: matchId } });
}

function daysLabel(days: number | null): string {
  if (days === null) return '—';
  if (days < 0) return `${Math.abs(days)} dagen verstreken`;
  if (days === 0) return 'Verloopt vandaag';
  return `${days} dagen tot oppositiedeadline verloopt`;
}
</script>

<template>
  <MwPage
    title="Oppositiedeadlines"
    description="Openstaande termijnen voor mogelijke én actieve matches. Verlopen termijnen gaan naar het matcharchief (niet meer aan te vechten)."
  >
    <div v-if="deadlinesQuery.isLoading.value" class="space-y-3">
      <SkeletonBlock height="3rem" />
      <SkeletonBlock height="3rem" />
      <SkeletonBlock height="3rem" />
    </div>

    <EmptyState
      v-else-if="grouped.length === 0"
      title="Geen openstaande deadlines"
      description="Zodra matches met een berekende oppositietermijn worden gesignaleerd, verschijnen ze hier."
    />

    <MwCard
      v-for="bucket in grouped"
      :key="bucket.key"
      :title="bucket.labelNl"
      :padding="false"
    >
      <ul class="divide-y divide-border">
        <li v-for="entry in bucket.entries" :key="entry.matchId">
          <button
            type="button"
            class="grid w-full grid-cols-1 items-center gap-3 px-5 py-3.5 text-left text-sm transition-colors hover:bg-surface-muted/50 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_5rem_7rem_7rem_minmax(8rem,1fr)]"
            @click="goToMatch(entry.matchId)"
          >
            <div class="min-w-0">
              <p class="text-xs font-medium text-text-muted">Eigen merk</p>
              <p class="truncate font-medium text-text">{{ entry.watchedTrademarkLabel }}</p>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-medium text-text-muted">Oppositiemerk</p>
              <p class="truncate font-medium text-text">{{ entry.candidateMarkText }}</p>
              <p class="truncate text-xs text-text-muted">{{ entry.registryCode }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-text-muted">Score</p>
              <p class="font-semibold tabular-nums">
                {{
                  scoreByMatchId.has(entry.matchId)
                    ? formatMatchScorePercent(scoreByMatchId.get(entry.matchId)!)
                    : '—'
                }}
              </p>
            </div>
            <div>
              <p class="text-xs font-medium text-text-muted">Start</p>
              <p class="text-xs text-text">{{ formatDate(entry.deadline?.startDate) }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-text-muted">Einde</p>
              <p class="text-xs text-text">{{ formatDate(entry.deadline?.deadlineDate) }}</p>
            </div>
            <div class="flex flex-col items-start gap-1 lg:items-end">
              <DeadlineIndicator
                :days-remaining="entry.daysRemaining"
                :deadline-date="entry.deadline?.deadlineDate"
              />
              <p class="text-xs text-text-muted">{{ daysLabel(entry.daysRemaining) }}</p>
            </div>
          </button>
        </li>
      </ul>
    </MwCard>
  </MwPage>
</template>
