<script setup lang="ts">
import { matchQueueForStatus } from '@merkwacht/domain';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import {
  matchExportUrl,
  useAcceptMatch,
  useAddMatchNote,
  useArchiveMatch,
  useMatch,
  useRejectMatch,
  useRequestAdvisorReview,
  useUpdateMatchStatus,
} from '../../api/matches';
import { useWatchedTrademark } from '../../api/watched-trademarks';
import { useToastStore } from '../../stores/toast';
import DossierAiExplanation from './match-dossier/DossierAiExplanation.vue';
import DossierClasses from './match-dossier/DossierClasses.vue';
import DossierComparison from './match-dossier/DossierComparison.vue';
import DossierHeader from './match-dossier/DossierHeader.vue';
import DossierHistory from './match-dossier/DossierHistory.vue';
import DossierScoreSection from './match-dossier/DossierScoreSection.vue';
import DossierTimeline from './match-dossier/DossierTimeline.vue';
import ReasonDialog from './match-dossier/ReasonDialog.vue';

const toast = useToastStore();

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));

const matchQuery = useMatch(id);
const watchedTrademarkId = computed(() => matchQuery.data.value?.watchedTrademarkId ?? '');
const watchedQuery = useWatchedTrademark(watchedTrademarkId);

const daysRemaining = computed(() => {
  const deadline = matchQuery.data.value?.candidate.oppositionDeadline;
  if (!deadline) return null;
  const diff = new Date(deadline.deadlineDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

const acceptMatch = useAcceptMatch();
const rejectMatch = useRejectMatch();
const archiveMatch = useArchiveMatch();
const updateStatus = useUpdateMatchStatus();
const addNote = useAddMatchNote();
const requestAdvisor = useRequestAdvisorReview();

const rejectDialogOpen = ref(false);
const notRelevantDialogOpen = ref(false);
const addNoteDialogOpen = ref(false);
const archiveDialogOpen = ref(false);

const busy = computed(
  () =>
    acceptMatch.isPending.value ||
    rejectMatch.isPending.value ||
    archiveMatch.isPending.value ||
    updateStatus.isPending.value ||
    addNote.isPending.value ||
    requestAdvisor.isPending.value,
);

function accept(): void {
  acceptMatch.mutate(id.value, {
    onSuccess: () => toast.success('Match geaccepteerd — verplaatst naar actieve matches'),
    onError: () => toast.error('Accepteren is mislukt. Probeer het opnieuw.'),
  });
}

async function confirmReject(reason: string): Promise<void> {
  if (reason.trim().length === 0) return;
  try {
    await rejectMatch.mutateAsync({ id: id.value, reason: reason.trim() });
    rejectDialogOpen.value = false;
    toast.success('Match afgewezen en naar archief verplaatst');
  } catch {
    toast.error('Afwijzen is mislukt. Probeer het opnieuw.');
  }
}

function confirmArchive(): void {
  archiveMatch.mutate(id.value, {
    onSuccess: () => {
      archiveDialogOpen.value = false;
      toast.success('Match naar archief verplaatst');
    },
    onError: () => toast.error('Archiveren is mislukt. Probeer het opnieuw.'),
  });
}


async function confirmNotRelevant(reason: string): Promise<void> {
  if (reason.trim().length === 0) return;
  try {
    await addNote.mutateAsync({ id: id.value, note: `Niet relevant: ${reason.trim()}` });
    await updateStatus.mutateAsync({ id: id.value, status: 'dismissed' });
    notRelevantDialogOpen.value = false;
    toast.success('Match gemarkeerd als niet relevant');
  } catch {
    toast.error('Markeren als niet relevant is mislukt. Probeer het opnieuw.');
  }
}

async function confirmAddNote(note: string): Promise<void> {
  if (note.trim().length === 0) return;
  try {
    await addNote.mutateAsync({ id: id.value, note: note.trim() });
    addNoteDialogOpen.value = false;
    toast.success('Notitie opgeslagen');
  } catch {
    toast.error('Notitie kon niet worden opgeslagen.');
  }
}


function requestAdvisorReview(): void {
  requestAdvisor.mutate(id.value, {
    onSuccess: () => toast.success('Adviesaanvraag is verzonden'),
    onError: () => toast.error('Adviesaanvraag is mislukt.'),
  });
}

function exportMatch(format: 'csv' | 'html' | 'pdf'): void {
  window.open(matchExportUrl(id.value, format), '_blank');
}

function backToList(): void {
  const match = matchQuery.data.value;
  if (match && matchQueueForStatus(match.status) === 'possible') {
    void router.push({ name: 'app-matches-possible' });
    return;
  }
  void router.push({ name: 'app-matches' });
}
</script>

<template>
  <div class="space-y-6">
    <button type="button" class="text-xs font-medium text-accent-strong hover:underline" @click="backToList">
      ← Terug naar merkbescherming
    </button>

    <template v-if="matchQuery.isLoading.value">
      <SkeletonBlock height="8rem" />
      <SkeletonBlock height="12rem" />
    </template>

    <MwBanner v-else-if="matchQuery.isError.value" tone="danger" title="Matchdossier kon niet worden geladen">
      <p>Er ging iets mis bij het ophalen van deze match.</p>
      <MwButton class="mt-2" size="sm" variant="secondary" @click="matchQuery.refetch()">Opnieuw proberen</MwButton>
    </MwBanner>

    <template v-else-if="matchQuery.data.value">
      <DossierHeader
        :match="matchQuery.data.value"
        :days-remaining="daysRemaining"
        :busy="busy"
        @accept="accept"
        @reject="rejectDialogOpen = true"
        @archive="archiveDialogOpen = true"
        @mark-not-relevant="notRelevantDialogOpen = true"
        @request-advisor="requestAdvisorReview"
        @add-note="addNoteDialogOpen = true"
        @export="exportMatch"
      />

      <DossierComparison :watched="watchedQuery.data.value" :match="matchQuery.data.value" />
      <DossierScoreSection :match="matchQuery.data.value" :days-remaining="daysRemaining" />

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DossierClasses :watched="watchedQuery.data.value" :match="matchQuery.data.value" />
        <DossierTimeline :match="matchQuery.data.value" />
      </div>

      <DossierAiExplanation :match="matchQuery.data.value" />
      <DossierHistory :match="matchQuery.data.value" />

      <ReasonDialog
        :open="rejectDialogOpen"
        title="Match afwijzen"
        description="Geef een korte reden op. De match wordt naar het archief verplaatst."
        placeholder="Bijv. andere waren/diensten, andere doelgroep…"
        required
        confirm-label="Afwijzen"
        tone="danger"
        :busy="busy"
        @confirm="confirmReject"
        @cancel="rejectDialogOpen = false"
      />

      <ReasonDialog
        :open="notRelevantDialogOpen"
        title="Markeer als niet relevant"
        description="Geef een korte reden op. Dit is verplicht zodat later duidelijk is waarom de match is afgewezen."
        placeholder="Bijv. andere waren/diensten, andere doelgroep…"
        required
        confirm-label="Niet relevant"
        tone="danger"
        :busy="busy"
        @confirm="confirmNotRelevant"
        @cancel="notRelevantDialogOpen = false"
      />

      <ReasonDialog
        :open="addNoteDialogOpen"
        title="Notitie toevoegen"
        placeholder="Interne notitie…"
        required
        confirm-label="Notitie opslaan"
        :busy="busy"
        @confirm="confirmAddNote"
        @cancel="addNoteDialogOpen = false"
      />

      <ConfirmDialog
        :open="archiveDialogOpen"
        title="Naar archief"
        description="Deze match wordt als niet relevant gearchiveerd en verdwijnt uit de actieve lijst."
        confirm-label="Naar archief"
        tone="danger"
        :busy="busy"
        @confirm="confirmArchive"
        @cancel="archiveDialogOpen = false"
      />
    </template>

    <p v-else class="text-sm text-text-muted">Deze match kon niet worden gevonden.</p>
  </div>
</template>
