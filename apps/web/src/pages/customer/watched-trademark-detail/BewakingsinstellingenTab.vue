<script setup lang="ts">
import { ref, watch } from 'vue';
import ConfirmDialog from '../../../components/ConfirmDialog.vue';
import { useSetWatchedTrademarkStatus, useUpdateWatchedTrademarkSettings } from '../../../api/watched-trademarks';
import type { WatchedTrademarkRecord } from '../../../api/types';

const props = defineProps<{ watched: WatchedTrademarkRecord }>();

const label = ref(props.watched.label);
watch(
  () => props.watched.id,
  () => {
    label.value = props.watched.label;
  },
);

const updateSettings = useUpdateWatchedTrademarkSettings(() => props.watched.id);
const setStatus = useSetWatchedTrademarkStatus();
const pendingAction = ref<'pause' | 'resume' | 'archive' | null>(null);

function saveLabel(): void {
  if (label.value.trim().length === 0 || label.value === props.watched.label) return;
  updateSettings.mutate({ label: label.value.trim() });
}

function confirmAction(): void {
  if (!pendingAction.value) return;
  setStatus.mutate(
    { id: props.watched.id, action: pendingAction.value },
    { onSuccess: () => (pendingAction.value = null) },
  );
}

const actionCopy: Record<'pause' | 'resume' | 'archive', { title: string; description: string; confirmLabel: string }> = {
  pause: {
    title: 'Bewaking pauzeren',
    description: 'Er worden tijdelijk geen nieuwe matches meer gegenereerd voor dit merk.',
    confirmLabel: 'Pauzeren',
  },
  resume: {
    title: 'Bewaking hervatten',
    description: 'Merkwacht hervat het vergelijken van nieuwe registerpublicaties met dit merk.',
    confirmLabel: 'Hervatten',
  },
  archive: {
    title: 'Merk archiveren',
    description: 'Dit merk verplaatst naar het archief en levert geen nieuwe matches meer op.',
    confirmLabel: 'Archiveren',
  },
};
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <div class="rounded-lg border border-border bg-surface p-5">
      <label for="detail-label" class="mb-1.5 block text-sm font-medium text-text">Interne naam</label>
      <div class="flex max-w-md gap-2">
        <input
          id="detail-label"
          v-model="label"
          type="text"
          maxlength="300"
          class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="button"
          class="shrink-0 rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="updateSettings.isPending.value || label.trim().length === 0 || label === watched.label"
          @click="saveLabel"
        >
          Opslaan
        </button>
      </div>
      <p v-if="updateSettings.isSuccess.value" class="mt-2 text-xs text-success">Wijzigingen opgeslagen.</p>
    </div>

    <div class="rounded-lg border border-border bg-surface p-5">
      <p class="text-sm font-medium text-text">Bewakingsstatus</p>
      <p class="mt-1 text-sm text-text-muted">Pauzeer, hervat of archiveer de bewaking van dit merk.</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-if="watched.status !== 'active'"
          type="button"
          class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted"
          @click="pendingAction = 'resume'"
        >
          Hervatten
        </button>
        <button
          v-if="watched.status === 'active'"
          type="button"
          class="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-muted"
          @click="pendingAction = 'pause'"
        >
          Pauzeren
        </button>
        <button
          v-if="watched.status !== 'archived'"
          type="button"
          class="rounded-md border border-danger/40 px-3.5 py-2 text-sm font-medium text-danger hover:bg-danger/5"
          @click="pendingAction = 'archive'"
        >
          Archiveren
        </button>
      </div>
    </div>

    <ConfirmDialog
      v-if="pendingAction"
      :open="Boolean(pendingAction)"
      :title="actionCopy[pendingAction].title"
      :description="actionCopy[pendingAction].description"
      :confirm-label="actionCopy[pendingAction].confirmLabel"
      :tone="pendingAction === 'archive' ? 'danger' : 'neutral'"
      :busy="setStatus.isPending.value"
      @confirm="confirmAction"
      @cancel="pendingAction = null"
    />
  </div>
</template>
