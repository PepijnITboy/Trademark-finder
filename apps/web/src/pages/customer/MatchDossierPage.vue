<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import SkeletonBlock from '../../components/SkeletonBlock.vue';
import { matchExportUrl, useAddMatchNote, useMatch, useRequestAdvisorReview, useUpdateMatchStatus } from '../../api/matches';
import { useWatchedTrademark } from '../../api/watched-trademarks';
import DossierAiExplanation from './match-dossier/DossierAiExplanation.vue';
import DossierClasses from './match-dossier/DossierClasses.vue';
import DossierComparison from './match-dossier/DossierComparison.vue';
import DossierHeader from './match-dossier/DossierHeader.vue';
import DossierHistory from './match-dossier/DossierHistory.vue';
import DossierScoreSection from './match-dossier/DossierScoreSection.vue';
import DossierTimeline from './match-dossier/DossierTimeline.vue';
import ReasonDialog from './match-dossier/ReasonDialog.vue';

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

const updateStatus = useUpdateMatchStatus();
const addNote = useAddMatchNote();
const requestAdvisor = useRequestAdvisorReview();

const notRelevantDialogOpen = ref(false);
const addNoteDialogOpen = ref(false);
const completeDialogOpen = ref(false);

const busy = computed(() => updateStatus.isPending.value || addNote.isPending.value || requestAdvisor.isPending.value);

function markRelevant(): void {
  updateStatus.mutate({ id: id.value, status: 'confirmed_conflict' });
}

async function confirmNotRelevant(reason: string): Promise<void> {
  if (reason.trim().length > 0) {
    await addNote.mutateAsync({ id: id.value, note: `Niet relevant: ${reason.trim()}` });
  }
  await updateStatus.mutateAsync({ id: id.value, status: 'dismissed' });
  notRelevantDialogOpen.value = false;
}

async function confirmAddNote(note: string): Promise<void> {
  if (note.trim().length === 0) return;
  await addNote.mutateAsync({ id: id.value, note: note.trim() });
  addNoteDialogOpen.value = false;
}

function confirmComplete(): void {
  updateStatus.mutate({ id: id.value, status: 'opposition_filed' }, { onSuccess: () => (completeDialogOpen.value = false) });
}

function requestAdvisorReview(): void {
  requestAdvisor.mutate(id.value);
}

function exportMatch(format: 'csv' | 'html'): void {
  window.open(matchExportUrl(id.value, format), '_blank');
}

function backToList(): void {
  void router.push({ name: 'app-matches' });
}
</script>

<template>
  <div class="space-y-6">
    <button type="button" class="text-xs font-medium text-accent-strong hover:underline" @click="backToList">
      ← Terug naar matches
    </button>

    <template v-if="matchQuery.isLoading.value">
      <SkeletonBlock height="8rem" />
      <SkeletonBlock height="12rem" />
    </template>

    <template v-else-if="matchQuery.data.value">
      <DossierHeader
        :match="matchQuery.data.value"
        :days-remaining="daysRemaining"
        :busy="busy"
        @mark-relevant="markRelevant"
        @mark-not-relevant="notRelevantDialogOpen = true"
        @request-advisor="requestAdvisorReview"
        @add-note="addNoteDialogOpen = true"
        @complete="completeDialogOpen = true"
        @export="exportMatch"
      />

      <DossierComparison :watched="watchedQuery.data.value" :match="matchQuery.data.value" />
      <DossierScoreSection :match="matchQuery.data.value" />

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DossierClasses :watched="watchedQuery.data.value" :match="matchQuery.data.value" />
        <DossierTimeline :match="matchQuery.data.value" />
      </div>

      <DossierAiExplanation :match="matchQuery.data.value" />
      <DossierHistory :match="matchQuery.data.value" />

      <ReasonDialog
        :open="notRelevantDialogOpen"
        title="Markeer als niet relevant"
        description="Geef optioneel een reden op. Dit helpt bij latere interne evaluatie."
        placeholder="Bijv. andere waren/diensten, andere doelgroep…"
        confirm-label="Niet relevant"
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
        :open="completeDialogOpen"
        title="Match afronden"
        description="Markeer deze match als afgerond (oppositie ingediend). Dit registreert dat de interne beoordeling is afgesloten."
        confirm-label="Afronden"
        :busy="busy"
        @confirm="confirmComplete"
        @cancel="completeDialogOpen = false"
      />
    </template>

    <p v-else class="text-sm text-text-muted">Deze match kon niet worden gevonden.</p>
  </div>
</template>
