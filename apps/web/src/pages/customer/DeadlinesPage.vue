<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import DeadlineIndicator from '../../components/DeadlineIndicator.vue';
import EmptyState from '../../components/EmptyState.vue';
import PageHeader from '../../components/PageHeader.vue';
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
  <div class="space-y-6">
    <PageHeader title="Deadlines" description="Openstaande oppositietermijnen, gegroepeerd naar urgentie." />

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

    <section v-for="bucket in grouped" :key="bucket.key" class="space-y-3">
      <h2 class="text-sm font-semibold text-text">{{ bucket.labelNl }}</h2>
      <div class="overflow-hidden rounded-lg border border-border bg-surface">
        <ul class="divide-y divide-border">
          <li v-for="entry in bucket.entries" :key="entry.matchId">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm hover:bg-surface-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              @click="goToMatch(entry.matchId)"
            >
              <div class="min-w-0">
                <p class="truncate font-medium text-text">{{ entry.candidateMarkText }}</p>
                <p class="truncate text-xs text-text-muted">
                  vs. {{ entry.watchedTrademarkLabel }} · {{ entry.registryCode }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-4">
                <span class="text-xs text-text-muted">{{ formatDate(entry.deadline?.deadlineDate) }}</span>
                <DeadlineIndicator :days-remaining="entry.daysRemaining" />
              </div>
            </button>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
