<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DataTable, { type DataTableColumn } from '../../components/DataTable.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwPage from '../../components/MwPage.vue';
import StatusBadge, { type BadgeTone } from '../../components/StatusBadge.vue';
import {
  formatEuroCents,
  formatScopeSummary,
  useNameResearchOrder,
  type NameResearchHitRecord,
} from '../../api/name-research';
import { formatDate, formatMatchScorePercent, formatNiceClasses } from '../../lib/format';
import { NAME_RESEARCH_DISCLAIMER_NL } from '@merkwacht/domain';

const route = useRoute();
const router = useRouter();
const orderId = () => String(route.params.id ?? '');
const orderQuery = useNameResearchOrder(orderId);
const order = computed(() => orderQuery.data.value);
const selectedHitId = ref<string | null>(null);

const selectedHit = computed(() =>
  order.value?.hits.find((h) => h.id === selectedHitId.value) ?? null,
);

const hitColumns: readonly DataTableColumn<NameResearchHitRecord>[] = [
  { key: 'priorMarkText', label: 'Ouder merk' },
  { key: 'registryCode', label: 'Register', width: '7rem' },
  { key: 'applicant', label: 'Houder' },
  { key: 'classes', label: 'Klassen' },
  { key: 'total', label: 'Risico', width: '6rem', align: 'right' },
];

const ADVICE_LABELS: Record<string, string> = {
  low: 'Laag risico-signaal',
  medium: 'Gemiddeld risico-signaal',
  high: 'Hoog risico-signaal',
};

const ADVICE_TONES: Record<string, BadgeTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

const STEP_TONES: Record<string, BadgeTone> = {
  completed: 'success',
  running: 'warning',
  pending: 'neutral',
  pending_connector: 'warning',
  failed: 'danger',
};

const STEP_LABELS: Record<string, string> = {
  completed: 'Klaar',
  running: 'Bezig',
  pending: 'Wacht',
  pending_connector: 'Connector volgt',
  failed: 'Mislukt',
};

function openHit(hit: NameResearchHitRecord): void {
  selectedHitId.value = hit.id;
}

function openAdvisor(): void {
  void router.push({ name: 'app-chat' });
}
</script>

<template>
  <MwPage
    :title="order ? `Rapport: ${order.markText}` : 'Merkonderzoek'"
    description="Resultaat van de pre-filing scan. Dit is geen Merkbescherming-dossier."
  >
    <MwBanner v-if="orderQuery.isError.value" tone="danger" title="Rapport niet gevonden">
      Dit merkonderzoek bestaat niet of hoort bij een andere organisatie.
    </MwBanner>

    <template v-else-if="order">
      <MwBanner tone="info" title="Disclaimer">{{ NAME_RESEARCH_DISCLAIMER_NL }}</MwBanner>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MwCard title="Eindadvies">
          <div class="space-y-3">
            <StatusBadge
              v-if="order.adviceBand"
              :label="ADVICE_LABELS[order.adviceBand] ?? order.adviceBand"
              :tone="ADVICE_TONES[order.adviceBand] ?? 'neutral'"
            />
            <p class="text-3xl font-semibold tabular-nums text-text">
              <template v-if="order.overallRiskScore != null">
                {{ Math.round(order.overallRiskScore) }}%
              </template>
              <template v-else>—</template>
            </p>
            <p class="text-sm text-text-muted">{{ order.adviceTextNl }}</p>
            <MwButton block @click="openAdvisor">Merk aanvragen via bureau</MwButton>
            <p class="text-xs text-text-muted">
              Geen abonnement nodig — we spelen uw verzoek door naar een merkbureau via de chat.
            </p>
          </div>
        </MwCard>

        <MwCard title="Aanvraag" class="lg:col-span-2">
          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div class="sm:col-span-2">
              <dt class="text-xs text-text-muted">Registers &amp; klassen</dt>
              <dd class="font-medium">{{ formatScopeSummary(order.scopes) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-text-muted">Drempel (weergave)</dt>
              <dd class="font-medium tabular-nums">{{ order.minScoreThreshold }}%</dd>
            </div>
            <div>
              <dt class="text-xs text-text-muted">Betaling</dt>
              <dd class="font-medium">
                {{ formatEuroCents(order.priceCents) }}
              </dd>
            </div>
            <div v-if="order.intendedNicheNl" class="sm:col-span-2">
              <dt class="text-xs text-text-muted">Niche / toelichting</dt>
              <dd class="text-sm text-text">{{ order.intendedNicheNl }}</dd>
            </div>
          </dl>
        </MwCard>
      </div>

      <MwCard title="Voortgang per register">
        <ul class="space-y-2">
          <li
            v-for="step in order.progressSteps"
            :key="step.id"
            class="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
          >
            <span>{{ step.labelNl }}</span>
            <StatusBadge
              :label="STEP_LABELS[step.status] ?? step.status"
              :tone="STEP_TONES[step.status] ?? 'neutral'"
            />
          </li>
        </ul>
      </MwCard>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <MwCard title="Gevonden oudere merken" :padding="false" class="lg:col-span-3">
          <DataTable
            embedded
            :columns="hitColumns"
            :rows="order.hits"
            :row-key="(row) => row.id"
            clickable-rows
            empty-title="Geen treffers boven de drempel"
            empty-description="Er zijn geen oudere merken gevonden die de minimale risicoscore halen."
            @row-click="openHit"
          >
            <template #cell-priorMarkText="{ row }">
              <span class="font-medium">{{ row.priorMarkText }}</span>
            </template>
            <template #cell-applicant="{ row }">
              <span class="text-text-muted">{{ row.applicantName ?? '—' }}</span>
            </template>
            <template #cell-classes="{ row }">{{ formatNiceClasses(row.niceClasses) }}</template>
            <template #cell-total="{ row }">{{ formatMatchScorePercent(row.totalRiskScore) }}</template>
          </DataTable>
        </MwCard>

        <MwCard title="Hit-detail" class="lg:col-span-2">
          <template v-if="selectedHit">
            <dl class="space-y-3 text-sm">
              <div>
                <dt class="text-xs text-text-muted">Merk</dt>
                <dd class="font-semibold">{{ selectedHit.priorMarkText }}</dd>
              </div>
              <div>
                <dt class="text-xs text-text-muted">Nummer</dt>
                <dd>{{ selectedHit.priorMarkNumber ?? '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-text-muted">Houder / aanvrager</dt>
                <dd>{{ selectedHit.applicantName ?? '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-text-muted">Indieningsdatum</dt>
                <dd>{{ selectedHit.filingDate ? formatDate(selectedHit.filingDate) : '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-text-muted">Registratie / publicatie</dt>
                <dd>
                  {{
                    selectedHit.registrationOrPublicationDate
                      ? formatDate(selectedHit.registrationOrPublicationDate)
                      : '—'
                  }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-text-muted">Type / status</dt>
                <dd>
                  {{ selectedHit.markType ?? '—' }}
                  · {{ selectedHit.statusNl ?? '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-text-muted">Klassen</dt>
                <dd>{{ formatNiceClasses(selectedHit.niceClasses) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-text-muted">Componentscores</dt>
                <dd class="mt-1 space-y-1 text-xs text-text-muted">
                  <p>Tekstueel {{ selectedHit.scores.textualSimilarity }}%</p>
                  <p>Fonologisch {{ selectedHit.scores.phoneticSimilarity }}%</p>
                  <p>Visueel {{ selectedHit.scores.visualSimilarity }}%</p>
                  <p>Klassenoverlap {{ selectedHit.scores.niceClassOverlap }}%</p>
                  <p class="font-medium text-text">
                    Totaal risico {{ Math.round(selectedHit.totalRiskScore) }}%
                  </p>
                </dd>
              </div>
            </dl>
          </template>
          <p v-else class="text-sm text-text-muted">
            Klik op een treffer om houder, data en scores te bekijken.
          </p>
        </MwCard>
      </div>
    </template>
  </MwPage>
</template>
