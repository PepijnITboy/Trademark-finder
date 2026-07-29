<script setup lang="ts">
import {
  assertWatchThresholdCompatibleWithRecipients,
  formatRecipientNotifySummaryNl,
  resolveClassPickerOptions,
  thresholdFloorsForWatch,
  type ClassificationSchemeId,
} from '@merkwacht/domain';
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import ConfirmDialog from '../../../components/ConfirmDialog.vue';
import MwBanner from '../../../components/MwBanner.vue';
import MwButton from '../../../components/MwButton.vue';
import MwField from '../../../components/MwField.vue';
import { withOptimisticSave } from '../../../composables/useOptimisticSave';
import { useNameResearchRegisters } from '../../../api/name-research';
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
const saving = ref(false);

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

const registersQuery = useNameResearchRegisters();

function schemeIdForRegister(code: string): ClassificationSchemeId {
  return (registersQuery.data.value?.find((r) => r.code === code)?.classificationSchemeId as ClassificationSchemeId) ?? 'nice_45';
}

/**
 * Class picker for the *combined* set of `watchedRegisters` selected below.
 * Unlike the name-research wizard (one independent picker per register),
 * this tab shows a single shared class picker across every watched
 * register - so when those registers use different classification
 * schemes, `resolveClassPickerOptions` correctly refuses to fabricate a
 * shared Nice 1-45 list and the banner below explains why.
 */
const classPicker = computed(() => resolveClassPickerOptions(watchedRegisters.value.map(schemeIdForRegister)));
const pickerClasses = computed(() =>
  classPicker.value.classes.map((c) => c.code).filter((c): c is number => typeof c === 'number'),
);
const ALL_NICE = pickerClasses;

const coveringRecipients = computed(() =>
  (recipientsQuery.data.value ?? []).filter(
    (r) =>
      r.isActive &&
      (r.watchedTrademarkIds.length === 0 || r.watchedTrademarkIds.includes(props.watched.id)),
  ),
);

const coveringThresholdFloors = computed(() =>
  thresholdFloorsForWatch(
    (recipientsQuery.data.value ?? []).map((r) => ({
      mode: r.mode,
      minScoreThreshold: r.minScoreThreshold,
      isActive: r.isActive,
      allWatches: r.watchedTrademarkIds.length === 0,
      watchedTrademarkIds: r.watchedTrademarkIds,
    })),
    props.watched.id,
  ),
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

async function saveWatchSettings(): Promise<void> {
  const gate = assertWatchThresholdCompatibleWithRecipients(
    minScoreThreshold.value,
    coveringThresholdFloors.value,
  );
  if (!gate.ok) {
    toast.error(gate.message);
    return;
  }

  const snapshot = {
    label: label.value,
    minScoreThreshold: minScoreThreshold.value,
    classMode: classMode.value,
    selectedClasses: [...selectedClasses.value],
    watchedRegisters: [...watchedRegisters.value],
  };

  saving.value = true;
  const result = await withOptimisticSave({
    apply: () => {
      /* form already holds the intended values */
    },
    rollback: () => {
      label.value = props.watched.label;
      minScoreThreshold.value = props.watched.watchSettings?.minScoreThreshold ?? 25;
      classMode.value = props.watched.watchSettings?.classMode ?? 'eigen';
      selectedClasses.value = [...(props.watched.watchSettings?.selectedNiceClasses ?? props.watched.niceClasses)];
      watchedRegisters.value = [...(props.watched.watchSettings?.watchedRegisters ?? [props.watched.registryCode])];
    },
    save: () =>
      updateSettings.mutateAsync({
        label: snapshot.label.trim() !== props.watched.label ? snapshot.label.trim() : undefined,
        minScoreThreshold: snapshot.minScoreThreshold,
        classMode: snapshot.classMode,
        selectedNiceClasses: snapshot.classMode === 'custom' ? snapshot.selectedClasses : props.watched.niceClasses,
        watchedRegisters: snapshot.watchedRegisters,
      }),
    onError: () => toast.error('Opslaan mislukt — wijzigingen teruggedraaid'),
  });
  if (result.ok) toast.success('Bewakingsinstellingen opgeslagen');
  saving.value = false;
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
        <h3 class="text-sm font-semibold text-text">Algemene matchdrempel</h3>
        <p class="mt-1 text-sm text-text-muted">
          Minimale score (0–100%) om een treffer in Merkbescherming te tonen. Mag niet hoger zijn dan de laagste
          drempelmelding die dit merk dekt.
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

    <div class="space-y-3 rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-text">Meldingsadressen voor dit merk</h3>
        <p class="mt-1 text-sm text-text-muted">
          Adressen beheert u op organisatieniveau. Hier ziet u welke dit merk dekken.
        </p>
      </div>
      <ul v-if="coveringRecipients.length" class="divide-y divide-border rounded-md border border-border">
        <li
          v-for="r in coveringRecipients"
          :key="r.id"
          class="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
        >
          <span class="min-w-0">
            <span class="block font-medium text-text">{{ r.email }}</span>
            <span class="text-xs text-text-muted">
              {{
                formatRecipientNotifySummaryNl({
                  mode: r.mode,
                  digestCadence: r.digestCadence ?? r.digestFrequency,
                  minScoreThreshold: r.minScoreThreshold,
                })
              }}
            </span>
          </span>
        </li>
      </ul>
      <p v-else class="text-sm text-text-muted">Geen actief meldingsadres dekt dit merk.</p>
      <RouterLink
        :to="{ name: 'app-organisatie', query: { tab: 'meldingen' } }"
        class="inline-flex text-sm font-medium text-accent-strong hover:underline"
      >
        Beheer meldingsadressen
      </RouterLink>
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
            class="mw-checkbox h-4 w-4 rounded border-border text-accent-strong focus:ring-accent"
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
        <h3 class="text-sm font-semibold text-text">Klassen bewaken</h3>
        <p class="mt-1 text-sm text-text-muted">
          {{
            classPicker.schemeId === 'nice_45' || !classPicker.schemeId
              ? 'Nice-classificatie (Benelux/EU). Standaard de klassen van uw merk.'
              : `Classificatieschema van het geselecteerde register. Standaard de klassen van uw merk.`
          }}
        </p>
      </div>
      <MwBanner v-if="!classPicker.comparable" tone="warning" title="Klassen niet vergelijkbaar tussen registers">
        De geselecteerde registers gebruiken verschillende classificatieschema's, dus klassen kunnen niet in één
        gecombineerde lijst worden getoond of vergeleken. Beperk de registers hierboven tot registers met hetzelfde
        schema om een gezamenlijke klassenselectie te maken.
      </MwBanner>
      <template v-else>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="mode in ([
              { id: 'eigen', label: 'Eigen klassen' },
              { id: 'custom', label: 'Aangepast' },
              { id: 'all', label: 'Alle klassen' },
            ] as const)"
            :key="mode.id"
            type="button"
            class="mw-chip rounded-md border px-3 py-2 text-sm"
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
            class="mw-chip min-w-[2.25rem] rounded border px-1.5 py-1 text-xs tabular-nums"
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
        <p v-else class="text-sm text-text-muted">
          {{
            classPicker.schemeId === 'nice_45'
              ? 'Alle Nice-klassen 1–45 worden meegenomen.'
              : `Alle klassen van het schema "${classPicker.schemeId}" worden meegenomen.`
          }}
        </p>
      </template>
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

    <MwButton variant="primary" :loading="saving || updateSettings.isPending.value" @click="saveWatchSettings">
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
