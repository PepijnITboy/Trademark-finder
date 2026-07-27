<script setup lang="ts">
import type { MatchQueue } from '@merkwacht/domain';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import DeadlineIndicator from '../../components/DeadlineIndicator.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwFilters from '../../components/MwFilters.vue';
import MwPage from '../../components/MwPage.vue';
import MwSelect from '../../components/MwSelect.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import {
  MATCH_QUEUE_LABELS_NL,
  MATCH_STATUS_LABELS_NL,
  useAcceptMatch,
  useArchiveMatch,
  useMatches,
  useRejectMatch,
} from '../../api/matches';
import { formatDate, formatMatchScorePercent, formatNiceClasses } from '../../lib/format';
import { priorityFromScore, type PriorityLevel } from '../../lib/priority';
import { highestScoreComponentLabel } from '../../lib/score-top';
import { useToastStore } from '../../stores/toast';
import type { TrademarkMatchRecord } from '../../api/types';
import ReasonDialog from './match-dossier/ReasonDialog.vue';

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const queue = computed<MatchQueue>(() =>
  route.name === 'app-matches-possible' ? 'possible' : 'active',
);
const isPossible = computed(() => queue.value === 'possible');

const matchesQuery = useMatches(computed(() => ({ queue: queue.value })));
const acceptMatch = useAcceptMatch();
const rejectMatch = useRejectMatch();
const archiveMatch = useArchiveMatch();

const priorityFilter = ref<PriorityLevel | 'all'>('all');
const searchTerm = ref('');
const sortOrder = ref<'score_desc' | 'score_asc'>('score_desc');

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Alle prioriteiten' },
  { value: 'high', label: 'Hoog' },
  { value: 'medium', label: 'Gemiddeld' },
  { value: 'low', label: 'Laag' },
] as const;

const SORT_OPTIONS = [
  { value: 'score_desc', label: 'Score: hoog → laag' },
  { value: 'score_asc', label: 'Score: laag → hoog' },
] as const;

const rejectTarget = ref<TrademarkMatchRecord | null>(null);
const archiveTarget = ref<TrademarkMatchRecord | null>(null);

const busy = computed(
  () => acceptMatch.isPending.value || rejectMatch.isPending.value || archiveMatch.isPending.value,
);

const filteredMatches = computed(() => {
  const all = matchesQuery.data.value ?? [];
  const filtered = all.filter((match) => {
    if (priorityFilter.value !== 'all' && priorityFromScore(match.totalScore).level !== priorityFilter.value) {
      return false;
    }
    if (searchTerm.value.trim().length > 0) {
      const term = searchTerm.value.trim().toLowerCase();
      const haystack = `${match.candidate.markText} ${match.watchedTrademarkLabel}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
  const dir = sortOrder.value === 'score_desc' ? -1 : 1;
  return [...filtered].sort((a, b) => dir * (a.totalScore - b.totalScore));
});

const pendingCount = computed(() => matchesQuery.data.value?.length ?? 0);

const columns = computed((): readonly DataTableColumn<TrademarkMatchRecord>[] => {
  const base: DataTableColumn<TrademarkMatchRecord>[] = [
    { key: 'watched', label: 'Eigenmerk' },
    { key: 'candidate', label: 'Match gevonden' },
    { key: 'score', label: 'Score', align: 'right', width: '5.5rem' },
    { key: 'topComponent', label: 'Hoogste', width: '9rem' },
    { key: 'niceClasses', label: 'Klassen', width: '8rem' },
  ];
  if (isPossible.value) {
    return [...base, { key: 'actions', label: 'Acties', width: '8rem', align: 'center' }];
  }
  return [
    ...base,
    { key: 'deadline', label: 'Termijn', width: '10rem' },
    { key: 'status', label: 'Status', width: '10rem' },
    { key: 'actions', label: '', width: '9rem', align: 'right' },
  ];
});

const inputClass =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function daysRemaining(match: TrademarkMatchRecord): number | null {
  const deadline = match.candidate.oppositionDeadline?.deadlineDate;
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function goToMatch(match: TrademarkMatchRecord): void {
  void router.push({ name: 'app-match-detail', params: { id: match.id } });
}

function clearFilters(): void {
  priorityFilter.value = 'all';
  searchTerm.value = '';
  sortOrder.value = 'score_desc';
}

function accept(row: TrademarkMatchRecord): void {
  acceptMatch.mutate(row.id, {
    onSuccess: () => toast.success('Match gemarkeerd als relevant — verplaatst naar actieve matches'),
    onError: () => toast.error('Accepteren is mislukt. Probeer het opnieuw.'),
  });
}

function openReject(row: TrademarkMatchRecord): void {
  rejectTarget.value = row;
}

async function confirmReject(reason: string): Promise<void> {
  if (!rejectTarget.value || reason.trim().length === 0) return;
  try {
    await rejectMatch.mutateAsync({ id: rejectTarget.value.id, reason: reason.trim() });
    rejectTarget.value = null;
    toast.success('Match als niet relevant naar archief verplaatst');
  } catch {
    toast.error('Afwijzen is mislukt. Probeer het opnieuw.');
  }
}

function openArchive(row: TrademarkMatchRecord): void {
  archiveTarget.value = row;
}

function confirmArchive(): void {
  if (!archiveTarget.value) return;
  const id = archiveTarget.value.id;
  archiveMatch.mutate(id, {
    onSuccess: () => {
      archiveTarget.value = null;
      toast.success('Match naar archief verplaatst');
    },
    onError: () => toast.error('Archiveren is mislukt. Probeer het opnieuw.'),
  });
}
</script>

<template>
  <MwPage
    :title="MATCH_QUEUE_LABELS_NL[queue]"
    :description="
      isPossible
        ? 'Beoordeel nieuw gesignaleerde treffers: vink aan als relevant, of markeer als niet relevant.'
        : 'Relevante matches in behandeling of met oppositie ingediend.'
    "
  >
    <template v-if="isPossible" #actions>
      <span
        class="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-warning/15 px-2 text-sm font-semibold text-warning"
        :aria-label="`${pendingCount} nog te keuren`"
      >
        {{ pendingCount }}
      </span>
    </template>

    <MwBanner v-if="matchesQuery.isError.value" tone="danger" title="Matches konden niet worden geladen">
      <p>Controleer of de API bereikbaar is en probeer het opnieuw.</p>
      <MwButton class="mt-2" size="sm" variant="secondary" @click="matchesQuery.refetch()">Opnieuw proberen</MwButton>
    </MwBanner>

    <MwFilters>
      <input
        v-model="searchTerm"
        type="search"
        placeholder="Zoek op merknaam…"
        aria-label="Zoek matches"
        class="w-56"
        :class="inputClass"
      />
      <MwSelect id="priority-filter" v-model="priorityFilter" :options="PRIORITY_OPTIONS" />
      <MwSelect id="score-sort" v-model="sortOrder" :options="SORT_OPTIONS" />
      <MwButton
        v-if="priorityFilter !== 'all' || searchTerm || sortOrder !== 'score_desc'"
        size="sm"
        variant="tertiary"
        @click="clearFilters"
      >
        Filters wissen
      </MwButton>
      <template #meta>
        {{ filteredMatches.length }} van {{ matchesQuery.data.value?.length ?? 0 }}
      </template>
    </MwFilters>

    <MwCard :padding="false">
      <DataTable
        embedded
        :columns="columns"
        :rows="filteredMatches"
        :row-key="(row) => row.id"
        :loading="matchesQuery.isLoading.value"
        :clickable-rows="!isPossible"
        :empty-title="isPossible ? 'Geen mogelijke matches' : 'Geen actieve matches'"
        :empty-description="
          isPossible
            ? 'Nieuwe registerpublicaties verschijnen hier zodra ze zijn vergeleken met uw bewaakte merken.'
            : 'Accepteer mogelijke matches om ze hier te behandelen.'
        "
        @row-click="goToMatch"
      >
        <template #cell-watched="{ row }">{{ row.watchedTrademarkLabel }}</template>
        <template #cell-candidate="{ row }">
          <span class="font-medium">{{ row.candidate.markText }}</span>
          <span class="ml-1 text-xs text-text-muted">({{ row.candidate.registryCode }})</span>
        </template>
        <template #cell-score="{ row }">
          <span class="font-semibold tabular-nums">{{ formatMatchScorePercent(row.totalScore) }}</span>
        </template>
        <template #cell-topComponent="{ row }">
          <span class="text-xs text-text-muted">{{ highestScoreComponentLabel(row.scores) }}</span>
        </template>
        <template #cell-niceClasses="{ row }">{{ formatNiceClasses(row.candidate.niceClasses) }}</template>
        <template #cell-deadline="{ row }">
          <DeadlineIndicator :days-remaining="daysRemaining(row)" />
        </template>
        <template #cell-status="{ row }">
          <StatusBadge :label="MATCH_STATUS_LABELS_NL[row.status]" tone="neutral" />
        </template>
        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-1" @click.stop>
            <template v-if="isPossible">
              <MwButton
                size="sm"
                variant="secondary"
                aria-label="Relevant — naar actief"
                title="Relevant"
                :disabled="busy"
                @click="accept(row)"
              >
                ✓
              </MwButton>
              <MwButton
                size="sm"
                variant="tertiary"
                aria-label="Niet relevant"
                title="Niet relevant"
                :disabled="busy"
                @click="openReject(row)"
              >
                ✕
              </MwButton>
            </template>
            <MwButton
              v-else
              size="sm"
              variant="tertiary"
              :disabled="busy"
              @click="openArchive(row)"
            >
              Naar archief
            </MwButton>
          </div>
        </template>
      </DataTable>
    </MwCard>

    <ReasonDialog
      :open="rejectTarget !== null"
      title="Niet relevant"
      description="Deze match gaat naar het archief. Kies of vul een reden in."
      placeholder="Toelichting…"
      preset="Niet relevant"
      required
      confirm-label="Naar archief"
      tone="danger"
      :busy="busy"
      @confirm="confirmReject"
      @cancel="rejectTarget = null"
    />

    <ConfirmDialog
      :open="archiveTarget !== null"
      title="Naar archief"
      description="Deze match wordt als niet relevant gearchiveerd en verdwijnt uit de actieve lijst."
      confirm-label="Naar archief"
      tone="danger"
      :busy="busy"
      @confirm="confirmArchive"
      @cancel="archiveTarget = null"
    />
  </MwPage>
</template>
