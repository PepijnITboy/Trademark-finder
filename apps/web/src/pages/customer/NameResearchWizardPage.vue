<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import WizardSteps from './wizard/WizardSteps.vue';
import { ApiError } from '../../api/client';
import {
  formatEuroCents,
  useCreateNameResearchOrder,
  useNameResearchCredits,
  useNameResearchQuote,
  useNameResearchRegisters,
  type NameResearchQuote,
  type NameResearchScopeRecord,
} from '../../api/name-research';
import { useToastStore } from '../../stores/toast';
import {
  NAME_RESEARCH_DISCLAIMER_NL,
  NAME_RESEARCH_MIN_THRESHOLD,
  shouldWarnLargeReport,
} from '@merkwacht/domain';

const STEP_LABELS = ['Merknaam', 'Registers & klassen', 'Drempel', 'Betalen'];
const ALL_NICE = Array.from({ length: 45 }, (_, i) => i + 1);

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
const minScoreThreshold = ref(40);
const thresholdInput = ref('40');
const useCredit = ref(true);
const quote = ref<NameResearchQuote | null>(null);
const submitError = ref<string | null>(null);

const registersQuery = useNameResearchRegisters();
const creditsQuery = useNameResearchCredits();
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
const credits = computed(() => creditsQuery.data.value);
const canUseCredit = computed(() => (credits.value?.balance ?? 0) > 0);
const warnLarge = computed(() => shouldWarnLargeReport(minScoreThreshold.value));

const scopes = computed((): NameResearchScopeRecord[] =>
  selectedCodes.value.map((code) => ({
    registryCode: code,
    niceClasses: classesByRegister[code]?.length
      ? [...classesByRegister[code]!]
      : [9, 35, 42],
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

watch(canUseCredit, (ok) => {
  if (!ok) useCredit.value = false;
}, { immediate: true });

watch(minScoreThreshold, (v) => {
  thresholdInput.value = String(v);
});

function syncThresholdFromInput(): void {
  const n = Number.parseInt(thresholdInput.value, 10);
  if (Number.isNaN(n)) {
    thresholdInput.value = String(minScoreThreshold.value);
    return;
  }
  minScoreThreshold.value = Math.min(100, Math.max(NAME_RESEARCH_MIN_THRESHOLD, n));
  thresholdInput.value = String(minScoreThreshold.value);
}

function toggleRegister(code: string): void {
  const set = new Set(selectedCodes.value);
  if (set.has(code)) {
    set.delete(code);
  } else {
    set.add(code);
    if (!classesByRegister[code]?.length) {
      classesByRegister[code] = [9, 35, 42];
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
  classesByRegister[code] = [...ALL_NICE];
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
      minScoreThreshold: minScoreThreshold.value,
      useCredit: useCredit.value && canUseCredit.value,
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
      <div v-if="step === 1" class="space-y-4">
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
        <label class="block space-y-1.5">
          <span class="text-sm font-medium text-text">Niche / toelichting (optioneel)</span>
          <textarea
            v-model="intendedNicheNl"
            rows="3"
            maxlength="2000"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Bijv. SaaS voor retailers in Benelux, focus op software (9/42)…"
          />
          <span class="block text-xs text-text-muted">
            Waar letten we extra op? Product, markt, of klassen die u wilt aanvragen.
          </span>
        </label>
        <div class="flex justify-end gap-2">
          <MwButton :disabled="markText.trim().length < 2" @click="step = 2">Volgende</MwButton>
        </div>
      </div>

      <div v-else-if="step === 2" class="space-y-4">
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
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-xs font-medium text-text-muted">Nice-klassen voor {{ reg.code }}</p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="text-xs font-medium text-accent-strong hover:underline"
                    @click="selectAllClasses(reg.code)"
                  >
                    Alle klassen
                  </button>
                  <button
                    type="button"
                    class="text-xs font-medium text-text-muted hover:underline"
                    @click="clearClasses(reg.code)"
                  >
                    Wissen
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-[repeat(9,minmax(0,1fr))] gap-1.5 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
                <button
                  v-for="n in ALL_NICE"
                  :key="`${reg.code}-${n}`"
                  type="button"
                  class="rounded-md border px-1.5 py-1.5 text-center text-xs tabular-nums transition-colors"
                  :class="
                    (classesByRegister[reg.code] ?? []).includes(n)
                      ? 'border-accent-strong bg-accent-soft font-semibold text-accent-strong'
                      : 'border-border text-text-muted hover:border-border-strong'
                  "
                  @click="toggleClass(reg.code, n)"
                >
                  {{ n }}
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

      <div v-else-if="step === 3" class="space-y-4">
        <label class="block space-y-2">
          <span class="text-sm font-medium text-text">Minimale risicoscore om te tonen</span>
          <div class="flex flex-wrap items-center gap-3">
            <input
              v-model.number="minScoreThreshold"
              type="range"
              :min="NAME_RESEARCH_MIN_THRESHOLD"
              max="100"
              step="1"
              class="min-w-[12rem] flex-1"
            />
            <div class="flex items-center gap-1">
              <input
                v-model="thresholdInput"
                type="number"
                :min="NAME_RESEARCH_MIN_THRESHOLD"
                max="100"
                class="w-20 rounded-md border border-border bg-surface px-2 py-1.5 text-sm tabular-nums"
                @change="syncThresholdFromInput"
                @blur="syncThresholdFromInput"
              />
              <span class="text-sm text-text-muted">%</span>
            </div>
          </div>
          <span class="block text-xs text-text-muted">
            Alles krijgt een score; treffers onder deze drempel verdwijnen uit het rapport.
            Dit heeft geen invloed op de prijs. Vloer {{ NAME_RESEARCH_MIN_THRESHOLD }}%.
          </span>
        </label>

        <MwBanner v-if="warnLarge" tone="warning" title="Groot rapport">
          Bij een lage drempel (onder 40%) kunnen honderden treffers zichtbaar worden. Verhoog
          de drempel als u alleen de sterkere risico’s wilt zien.
        </MwBanner>

        <p v-if="quote" class="text-sm text-text">
          Prijs blijft {{ formatEuroCents(quote.totalCents) }} (registers).
        </p>

        <div class="flex justify-between gap-2">
          <MwButton variant="secondary" @click="step = 2">Terug</MwButton>
          <MwButton @click="step = 4">Volgende</MwButton>
        </div>
      </div>

      <div v-else class="space-y-4">
        <p class="text-sm text-text">
          Merknaam <strong>{{ markText }}</strong>
          · {{ scopes.length }} register(s)
          · drempel {{ minScoreThreshold }}%
        </p>
        <ul class="space-y-1 text-xs text-text-muted">
          <li v-for="s in scopes" :key="s.registryCode">
            {{ s.registryCode }}:
            {{
              s.niceClasses.length >= 45
                ? 'alle klassen'
                : s.niceClasses.join(', ')
            }}
          </li>
        </ul>
        <p v-if="quote" class="text-lg font-semibold tabular-nums">
          {{ formatEuroCents(quote.totalCents) }}
        </p>
        <label v-if="canUseCredit" class="flex items-start gap-3 rounded-md border border-border p-3">
          <input v-model="useCredit" type="checkbox" class="mt-1" />
          <span>
            <span class="block text-sm font-medium">1 credit gebruiken (gratis scannen)</span>
            <span class="text-xs text-text-muted">
              Saldo: {{ credits?.balance ?? 0 }} credit(s)
            </span>
          </span>
        </label>
        <p v-else class="text-sm text-text-muted">
          Geen credits beschikbaar — betaling via iDEAL of kaart (demo rondt direct af).
        </p>
        <MwBanner v-if="submitError" tone="danger" title="Aanvraag mislukt">{{ submitError }}</MwBanner>
        <div class="flex justify-between gap-2">
          <MwButton variant="secondary" @click="step = 3">Terug</MwButton>
          <MwButton :loading="createMutation.isPending.value" @click="submit">
            {{ useCredit && canUseCredit ? 'Start met credit' : 'Betalen en starten' }}
          </MwButton>
        </div>
      </div>
    </MwCard>
  </MwPage>
</template>
