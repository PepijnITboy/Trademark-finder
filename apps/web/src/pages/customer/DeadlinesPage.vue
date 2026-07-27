<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import DeadlineIndicator from '../../components/DeadlineIndicator.vue';
import EmptyState from '../../components/EmptyState.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import MwTooltip from '../../components/MwTooltip.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import { useDeadlines } from '../../api/deadlines';
import { formatDate } from '../../lib/format';
import { deadlineBucketKey, deadlineBucketsInOrder } from '../../lib/priority';
import type { DeadlineEntry } from '../../api/types';

const router = useRouter();
const deadlinesQuery = useDeadlines();

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
</script>

<template>
  <MwPage
    title="Oppositiedeadlines"
    description="Alleen termijnen die nog open staan — verstreken termijnen staan in het matcharchief."
  >
    <MwBanner tone="info" title="Bron van de termijn">
      Termijnen komen uit de registerpublicatie van de gevonden match. Controleer altijd de officiële bron bij twijfel.
    </MwBanner>

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
            class="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-sm hover:bg-surface-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            @click="goToMatch(entry.matchId)"
          >
            <div class="min-w-0">
              <p class="truncate font-medium text-text">{{ entry.candidateMarkText }}</p>
              <p class="truncate text-xs text-text-muted">
                Eigenmerk: {{ entry.watchedTrademarkLabel }} · {{ entry.registryCode }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-4">
              <MwTooltip text="Oppositietermijn volgens registerpublicatie">
                <span class="text-xs text-text-muted">{{ formatDate(entry.deadline?.deadlineDate) }}</span>
              </MwTooltip>
              <DeadlineIndicator :days-remaining="entry.daysRemaining" />
            </div>
          </button>
        </li>
      </ul>
    </MwCard>
  </MwPage>
</template>
