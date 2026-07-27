<script setup lang="ts">
import { assertWatchThresholdCompatibleWithRecipients } from '@merkwacht/domain';
import { computed, ref, watch } from 'vue';
import ConfirmDialog from '../../../components/ConfirmDialog.vue';
import MwButton from '../../../components/MwButton.vue';
import MwField from '../../../components/MwField.vue';
import { useNotificationRecipients } from '../../../api/notification-recipients';
import { useSetWatchedTrademarkStatus, useUpdateWatchedTrademarkSettings } from '../../../api/watched-trademarks';
import type { WatchedTrademarkRecord } from '../../../api/types';
import { useToastStore } from '../../../stores/toast';

const LIVE_REGISTERS = [{ code: 'BOIP', label: 'Benelux (BOIP)', live: true }] as const;
const UPCOMING_REGISTERS = [
  { code: 'EUIPO', label: 'Europees (EUIPO)', live: false },
  { code: 'DPMA', label: 'Duitsland (DPMA)', live: false },
  { code: 'INPI', label: 'Frankrijk (INPI)', live: false },
  { code: 'OEPM', label: 'Spanje (OEPM)', live: false },
  { code: 'WIPO', label: 'Wereldwijd (WIPO)', live: false },
] as const;

const props = defineProps<{ watched: WatchedTrademarkRecord }>();
const toast = useToastStore();
const recipientsQuery = useNotificationRecipients();

const label = ref(props.watched.label);
const minScoreThreshold = ref(props.watched.watchSettings?.minScoreThreshold ?? 25);
const classMode = ref<'eigen' | 'custom' | 'all'>(props.watched.watchSettings?.classMode ?? 'eigen');
const selectedClasses = ref<number[]>([...(props.watched.watchSettings?.selectedNiceClasses ?? props.watched.niceClasses)]);
const watchedRegisters = ref<string[]>([...(props.watched.watchSettings?.watchedRegisters ?? [props.watched.registryCode])]);

watch(
  () => props.watched.id,
  () => {
    label.value = props.watched.label;
    minScoreThreshold.value = props.watched.watchSettings?.minScoreThreshold ?? 25;
    classMode.value = props.watched.watchSettings?.classMode ?? 'eigen';
    selectedClasses.value = [...(props.watched.watchSettings?.selectedNiceClasses ?? props.watched.niceClasses)];
    watchedRegisters.value = [...(props.watched.watchSettings?.watchedRegisters ?? [props.watched.registryCode])];
  },
);

const updateSettings = useUpdateWatchedTrademarkSettings(() => props.watched.id);
const setStatus = useSetWatchedTrademarkStatus();
const pendingAction = ref<'pause' | 'resume' | 'archive' | null>(null);

const ALL_NICE = computed(() => Array.from({ length: 45 }, (_, i) => i + 1));

const coveringRecipientThresholds = computed(() =>
  (recipientsQuery.data.value ?? [])
    .filter((r) => r.isActive && (r.watchedTrademarkIds.length === 0 || r.watchedTrademarkIds.includes(props.watched.id)))
    .map((r) => r.minScoreThreshold),
);

function toggleClass(n: number): void {
  if (selectedClasses.value.includes(n)) {
    selectedClasses.value = selectedClasses.value.filter((c) => c !== n);
  } else {
    selectedClasses.value = [...selectedClasses.value, n].sort((a, b) => a - b);
  }
}

function toggleRegister(code: string, live: boolean): void {
  if (!live) return;
  if (watchedRegisters.value.includes(code)) {
    if (watchedRegisters.value.length === 1) return;
    watchedRegisters.value = watchedRegisters.value.filter((c) => c !== code);
  } else {
    watchedRegisters.value = [...watchedRegisters.value, code];
  }
}

function saveWatchSettings(): void {
  const gate = assertWatchThresholdCompatibleWithRecipients(
    minScoreThreshold.value,
    coveringRecipientThresholds.value,
  );
  if (!gate.ok) {
    toast.error(gate.message);
    return;
  }

  updateSettings.mutate(
    {
      label: label.value.trim() !== props.watched.label ? label.value.trim() : undefined,
      minScoreThreshold: minScoreThreshold.value,
      classMode: classMode.value,
      selectedNiceClasses: classMode.value === 'custom' ? selectedClasses.value : props.watched.niceClasses,
      watchedRegisters: watchedRegisters.value,
    },
    {
      onSuccess: () => toast.success('Bewakingsinstellingen opgeslagen'),
      onError: () => toast.error('Opslaan mislukt'),
    },
  );
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
    <div class="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <MwField label="Interne naam" for-id="detail-label">
        <input
          id="detail-label"
          v-model="label"
          type="text"
          maxlength="300"
          class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </MwField>
    </div>

    <div class="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-text">Algemene meldingsdrempel</h3>
        <p class="mt-1 text-sm text-text-muted">
          Minimale score (0–100%) om een treffer als mogelijke match te tonen. Mag niet hoger zijn dan de laagste
          e-maildrempel die dit merk dekt.
        </p>
      </div>
      <MwField label="Drempel (%)" for-id="score-threshold">
        <input
          id="score-threshold"
          v-model.number="minScoreThreshold"
          type="number"
          min="0"
          max="100"
          step="1"
          class="w-28 rounded-md border border-border bg-surface px-3 py-2 text-sm tabular-nums text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </MwField>
    </div>

    <div class="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-text">Registers bewaken</h3>
        <p class="mt-1 text-sm text-text-muted">
          Alleen Benelux (BOIP) matcht live. Andere registers kunt u alvast selecteren — beschikbaar zodra de koppeling live is.
        </p>
      </div>
      <div class="space-y-2">
        <label
          v-for="reg in [...LIVE_REGISTERS, ...UPCOMING_REGISTERS]"
          :key="reg.code"
          class="flex items-center gap-3 rounded-md border border-border px-3 py-2.5"
          :class="!reg.live && 'opacity-70'"
        >
          <input
            type="checkbox"
            class="h-4 w-4 rounded border-border text-accent-strong focus:ring-accent"
            :checked="watchedRegisters.includes(reg.code)"
            :disabled="!reg.live"
            @change="toggleRegister(reg.code, reg.live)"
          />
          <span class="flex-1 text-sm text-text">{{ reg.label }}</span>
          <span v-if="!reg.live" class="text-xs text-text-muted">Binnenkort</span>
        </label>
      </div>
    </div>

    <div class="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-text">Nice-klassen bewaken</h3>
        <p class="mt-1 text-sm text-text-muted">
          Nice-classificatie (Benelux/EU). Standaard de klassen van uw merk.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="mode in ([
            { id: 'eigen', label: 'Eigen klassen' },
            { id: 'custom', label: 'Aangepast' },
            { id: 'all', label: 'Alle klassen' },
          ] as const)"
          :key="mode.id"
          type="button"
          class="rounded-md border px-3 py-2 text-sm"
          :class="
            classMode === mode.id
              ? 'border-accent bg-accent-soft font-medium text-accent-strong'
              : 'border-border text-text-muted hover:bg-surface-muted'
          "
          @click="classMode = mode.id"
        >
          {{ mode.label }}
        </button>
      </div>
      <p v-if="classMode === 'eigen'" class="text-sm text-text-muted">
        Klassen van dit merk: {{ watched.niceClasses.join(', ') || '—' }}
      </p>
      <div v-else-if="classMode === 'custom'" class="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
        <button
          v-for="n in ALL_NICE"
          :key="n"
          type="button"
          class="min-w-[2.25rem] rounded border px-1.5 py-1 text-xs tabular-nums"
          :class="
            selectedClasses.includes(n)
              ? 'border-accent bg-accent-soft font-medium text-accent-strong'
              : 'border-border text-text-muted'
          "
          @click="toggleClass(n)"
        >
          {{ n }}
        </button>
      </div>
      <p v-else class="text-sm text-text-muted">Alle Nice-klassen 1–45 worden meegenomen.</p>
    </div>

    <div class="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <p class="text-sm font-medium text-text">Bewakingsstatus</p>
      <p class="mt-1 text-sm text-text-muted">Pauzeer, hervat of archiveer de bewaking van dit merk.</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <MwButton v-if="watched.status === 'active'" variant="secondary" @click="pendingAction = 'pause'">Pauzeren</MwButton>
        <MwButton v-if="watched.status === 'paused'" variant="secondary" @click="pendingAction = 'resume'">Hervatten</MwButton>
        <MwButton v-if="watched.status !== 'archived'" variant="danger" @click="pendingAction = 'archive'">Archiveren</MwButton>
      </div>
    </div>

    <MwButton variant="primary" :loading="updateSettings.isPending.value" @click="saveWatchSettings">
      Instellingen opslaan
    </MwButton>

    <ConfirmDialog
      v-if="pendingAction"
      :open="Boolean(pendingAction)"
      :title="actionCopy[pendingAction].title"
      :description="actionCopy[pendingAction].description"
      :confirm-label="actionCopy[pendingAction].confirmLabel"
      :tone="pendingAction === 'archive' ? 'danger' : 'neutral'"
      @confirm="confirmAction"
      @cancel="pendingAction = null"
    />
  </div>
</template>
