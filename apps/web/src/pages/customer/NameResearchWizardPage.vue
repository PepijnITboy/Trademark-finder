<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  NAME_RESEARCH_DEFAULT_THRESHOLD,
  NAME_RESEARCH_DISCLAIMER_NL,
  resolveClassPickerOptions,
  type ClassificationSchemeId,
} from '@merkwacht/domain';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import WizardSteps from '../../components/motion/WizardSteps.vue';
import { ApiError } from '../../api/client';
import {
  formatEuroCents,
  useCreateNameResearchOrder,
  useNameResearchQuote,
  useNameResearchRegisters,
  type NameResearchQuote,
  type NameResearchScopeRecord,
} from '../../api/name-research';
import { useToastStore } from '../../stores/toast';

const STEP_LABELS = ['Merknaam', 'Registers & klassen', 'Toelichting', 'Betalen'] as const;

const router = useRouter();
const toast = useToastStore();
const step = ref(1);
const markText = ref('');
const intendedNicheNl = ref('');
const registerSearch = ref('');
const selectedCodes = ref<string[]>(['BOIP']);
const classesByRegister = reactive<Record<string, number[]>>({
  BOIP: [9, 35, 42],
});
const quote = ref<NameResearchQuote | null>(null);
const submitError = ref<string | null>(null);

const registersQuery = useNameResearchRegisters();
const quoteMutation = useNameResearchQuote();
const createMutation = useCreateNameResearchOrder();

const availableRegisters = computed(() => registersQuery.data.value ?? []);
const filteredRegisters = computed(() => {
  const q = registerSearch.value.trim().toLowerCase();
  if (!q) return availableRegisters.value;
  return availableRegisters.value.filter(
    (r) =>
      r.code.toLowerCase().includes(q) ||
      r.displayNameNl.toLowerCase().includes(q) ||
      r.regionNl.toLowerCase().includes(q),
  );
});

/** Classification scheme for a register, from the catalog's `classificationSchemeId` (defaults to `nice_45`). */
function schemeIdForRegister(code: string): ClassificationSchemeId {
  return (availableRegisters.value.find((r) => r.code === code)?.classificationSchemeId as ClassificationSchemeId) ?? 'nice_45';
}

/**
 * Class options for a single register's picker, resolved via
 * `resolveClassPickerOptions` rather than a hardcoded Nice 1-45 list, so a
 * register on a non-Nice scheme (e.g. US legacy certification classes)
 * never shows fabricated Nice classes. Each register has its own
 * independent picker, so single-scheme resolution is always `comparable`.
 */
function classOptionsForRegister(code: string) {
  return resolveClassPickerOptions([schemeIdForRegister(code)]).classes;
}

function defaultClassesForRegister(code: string): number[] {
  const options = classOptionsForRegister(code);
  const numericCodes = options.map((c) => c.code).filter((c): c is number => typeof c === 'number');
  const preferred = numericCodes.filter((n) => [9, 35, 42].includes(n));
  return preferred.length ? preferred : numericCodes.slice(0, 3);
}

const scopes = computed((): NameResearchScopeRecord[] =>
  selectedCodes.value.map((code) => ({
    registryCode: code,
    niceClasses: classesByRegister[code]?.length
      ? [...classesByRegister[code]!]
      : defaultClassesForRegister(code),
  })),
);

const scopesValid = computed(() =>
  scopes.value.length > 0 && scopes.value.every((s) => s.niceClasses.length > 0),
);

watch(
  scopes,
  async () => {
    if (!scopesValid.value) {
      quote.value = null;
      return;
    }
    try {
      const result = await quoteMutation.mutateAsync({ scopes: scopes.value });
      quote.value = result.quote;
    } catch {
      quote.value = null;
    }
  },
  { immediate: true, deep: true },
);

function toggleRegister(code: string): void {
  const set = new Set(selectedCodes.value);
  if (set.has(code)) {
    set.delete(code);
  } else {
    set.add(code);
    if (!classesByRegister[code]?.length) {
      classesByRegister[code] = defaultClassesForRegister(code);
    }
  }
  selectedCodes.value = [...set];
}

function toggleClass(code: string, n: number): void {
  const current = new Set(classesByRegister[code] ?? []);
  if (current.has(n)) current.delete(n);
  else current.add(n);
  classesByRegister[code] = [...current].sort((a, b) => a - b);
}

function selectAllClasses(code: string): void {
  classesByRegister[code] = classOptionsForRegister(code)
    .map((c) => c.code)
    .filter((c): c is number => typeof c === 'number');
}

function clearClasses(code: string): void {
  classesByRegister[code] = [];
}

async function submit(): Promise<void> {
  submitError.value = null;
  if (!scopesValid.value) {
    submitError.value = 'Selecteer per register minstens één Nice-klasse.';
    return;
  }
  try {
    const { order } = await createMutation.mutateAsync({
      markText: markText.value.trim(),
      intendedNicheNl: intendedNicheNl.value.trim() || null,
      scopes: scopes.value,
      minScoreThreshold: NAME_RESEARCH_DEFAULT_THRESHOLD,
      useCredit: false,
    });
    toast.success('Merkonderzoek gestart');
    void router.push({ name: 'app-merkonderzoek-detail', params: { id: order.id } });
  } catch (error) {
    submitError.value =
      error instanceof ApiError ? error.message : 'Aanvraag mislukt. Probeer het opnieuw.';
    toast.error(submitError.value);
  }
}
</script>

<template>
  <MwPage
    title="Nieuw merkonderzoek"
    description="Controleer of een nieuwe merknaam risico loopt op oudere merken vóór u deponeert."
  >
    <WizardSteps :current="step" :labels="STEP_LABELS" />

    <MwBanner tone="info" title="Geen juridisch advies">
      {{ NAME_RESEARCH_DISCLAIMER_NL }}
    </MwBanner>

    <MwCard>
      <Transition name="mw-step" mode="out-in">
        <div v-if="step === 1" key="step-1" class="space-y-4">
          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-text">Gewenste merknaam</span>
            <input
              v-model="markText"
              type="text"
              maxlength="120"
              class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Bijv. NOVAFORM"
            />
          </label>
          <div class="flex justify-end gap-2">
            <MwButton :disabled="markText.trim().length < 2" @click="step = 2">Volgende</MwButton>
          </div>
        </div>

        <div v-else-if="step === 2" key="step-2" class="space-y-4">
          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-text">Zoek register</span>
            <input
              v-model="registerSearch"
              type="search"
              class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Bijv. Benelux, EUIPO, Duitsland…"
            />
          </label>

          <ul class="space-y-3">
            <li
              v-for="reg in filteredRegisters"
              :key="reg.code"
              class="rounded-lg border border-border p-3"
              :class="selectedCodes.includes(reg.code) ? 'border-accent-strong bg-accent-soft/15' : ''"
            >
              <div class="flex items-start justify-between gap-3">
                <button
                  type="button"
                  class="flex flex-1 items-start gap-3 text-left"
                  @click="toggleRegister(reg.code)"
                >
                  <span
                    class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border"
                    :class="
                      selectedCodes.includes(reg.code)
                        ? 'border-accent-strong bg-accent-strong text-white'
                        : 'border-border bg-surface'
                    "
                    aria-hidden="true"
                  >
                    <svg
                      v-if="selectedCodes.includes(reg.code)"
                      class="h-3.5 w-3.5"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2.5 6.2L4.8 8.5L9.5 3.5"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                  <span>
                    <span class="block text-sm font-medium text-text">{{ reg.displayNameNl }}</span>
                    <span class="text-xs text-text-muted">
                      {{ reg.regionNl }}
                      <template v-if="reg.connectorStatus !== 'live'"> · connector volgt</template>
                    </span>
                  </span>
                </button>
                <span class="text-sm tabular-nums text-text">{{ formatEuroCents(reg.basePriceCents) }}</span>
              </div>

              <div v-if="selectedCodes.includes(reg.code)" class="mt-3 space-y-2 border-t border-border pt-3">
                <p class="text-xs font-medium text-text-muted">Nice-klassen voor {{ reg.code }}</p>
                <MwButton
                  variant="primary"
                  size="sm"
                  block
                  class="mb-1"
                  @click="selectAllClasses(reg.code)"
                >
                  Alle klassen
                </MwButton>
                <div class="grid grid-cols-[repeat(9,minmax(0,1fr))] gap-1.5 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
                  <button
                    v-for="cls in classOptionsForRegister(reg.code)"
                    :key="`${reg.code}-${cls.code}`"
                    type="button"
                    :title="cls.labelNl"
                    class="mw-chip rounded-md border px-1.5 py-1.5 text-center text-xs tabular-nums"
                    :class="
                      (classesByRegister[reg.code] ?? []).includes(Number(cls.code))
                        ? 'border-accent-strong bg-accent-soft font-semibold text-accent-strong'
                        : 'border-border text-text-muted hover:border-border-strong'
                    "
                    @click="toggleClass(reg.code, Number(cls.code))"
                  >
                    {{ cls.code }}
                  </button>
                </div>
                <div class="flex justify-end">
                  <button
                    type="button"
                    class="text-xs font-medium text-text-muted hover:underline"
                    @click="clearClasses(reg.code)"
                  >
                    Wissen
                  </button>
                </div>
                <p
                  v-if="!(classesByRegister[reg.code] ?? []).length"
                  class="text-xs text-danger"
                >
                  Selecteer minstens één klasse voor dit register.
                </p>
              </div>
            </li>
          </ul>

          <p v-if="quote" class="text-sm font-medium text-text">
            Totaal: {{ formatEuroCents(quote.totalCents) }}
            <span class="font-normal text-text-muted">(alleen geselecteerde registers)</span>
          </p>

          <div class="flex justify-between gap-2">
            <MwButton variant="secondary" @click="step = 1">Terug</MwButton>
            <MwButton :disabled="!scopesValid" @click="step = 3">Volgende</MwButton>
          </div>
        </div>

        <div v-else-if="step === 3" key="step-3" class="space-y-4">
          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-text">Toelichting (optioneel)</span>
            <textarea
              v-model="intendedNicheNl"
              rows="4"
              maxlength="2000"
              class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Bijv. SaaS voor retailers in Benelux, focus op software (9/42)…"
            />
            <span class="block text-xs text-text-muted">
              Waar letten we extra op? Product, markt, of klassen die u wilt aanvragen.
            </span>
          </label>
          <div class="flex justify-between gap-2">
            <MwButton variant="secondary" @click="step = 2">Terug</MwButton>
            <MwButton @click="step = 4">Volgende</MwButton>
          </div>
        </div>

        <div v-else key="step-4" class="space-y-4">
          <p class="text-sm text-text">
            Merknaam <strong>{{ markText }}</strong>
            · {{ scopes.length }} register(s)
          </p>
          <ul class="space-y-1 text-xs text-text-muted">
            <li v-for="s in scopes" :key="s.registryCode">
              {{ s.registryCode }}:
              {{
                s.niceClasses.length >= classOptionsForRegister(s.registryCode).length
                  ? 'alle klassen'
                  : s.niceClasses.join(', ')
              }}
            </li>
          </ul>
          <p v-if="intendedNicheNl.trim()" class="text-sm text-text-muted">
            Toelichting: {{ intendedNicheNl.trim() }}
          </p>
          <p v-if="quote" class="text-lg font-semibold tabular-nums">
            {{ formatEuroCents(quote.totalCents) }}
          </p>
          <p class="text-sm text-text-muted">
            Betaling per aanvraag via iDEAL of kaart (demo rondt direct af). Factuur verschijnt onder Betalingen.
          </p>
          <MwBanner v-if="submitError" tone="danger" title="Aanvraag mislukt">{{ submitError }}</MwBanner>
          <div class="flex justify-between gap-2">
            <MwButton variant="secondary" @click="step = 3">Terug</MwButton>
            <MwButton :loading="createMutation.isPending.value" @click="submit">
              Betalen en starten
            </MwButton>
          </div>
        </div>
      </Transition>
    </MwCard>
  </MwPage>
</template>
