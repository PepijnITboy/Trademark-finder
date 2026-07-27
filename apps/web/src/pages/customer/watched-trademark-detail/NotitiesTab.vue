<script setup lang="ts">
import { ref, watch } from 'vue';
import { useUpdateWatchedTrademarkSettings } from '../../../api/watched-trademarks';
import type { WatchedTrademarkRecord } from '../../../api/types';

const props = defineProps<{ watched: WatchedTrademarkRecord }>();

const notes = ref(props.watched.notes ?? '');
watch(
  () => props.watched.id,
  () => {
    notes.value = props.watched.notes ?? '';
  },
);

const updateSettings = useUpdateWatchedTrademarkSettings(() => props.watched.id);

function save(): void {
  updateSettings.mutate({ notes: notes.value.trim() === '' ? null : notes.value.trim() });
}
</script>

<template>
  <div class="max-w-2xl space-y-3">
    <label for="watch-notes" class="block text-sm font-medium text-text">Interne notities</label>
    <textarea
      id="watch-notes"
      v-model="notes"
      rows="8"
      maxlength="2000"
      placeholder="Bijv. contactpersoon merkengemachtigde, achtergrond bij dit merk, afspraken met de klant…"
      class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    />
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="rounded-md bg-accent-strong px-3.5 py-2 text-sm font-medium text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="updateSettings.isPending.value || notes === (watched.notes ?? '')"
        @click="save"
      >
        Notitie opslaan
      </button>
      <p v-if="updateSettings.isSuccess.value" class="text-xs text-success">Opgeslagen.</p>
    </div>
  </div>
</template>
