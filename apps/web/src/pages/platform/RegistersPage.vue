<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { CONTINENT_LABELS_NL, sortRegistersByPriority, type RegisterContinent } from '@merkwacht/domain';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwField from '../../components/MwField.vue';
import StatusBadge, { type BadgeTone } from '../../components/StatusBadge.vue';
import { apiRequest } from '../../api/client';
import type { RegisterCatalogRecord } from '../../api/name-research';
import { formatDateTime } from '../../lib/format';
import { useToastStore } from '../../stores/toast';
import PlatformPageHeader from './PlatformPageHeader.vue';

interface RuntimeState {
  registryCode: string;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
  ftpConfigured: boolean;
  lastProbeStatus: string | null;
  lastProbeMessage: string | null;
  lastProbeAt: string | null;
  lastFetchAt: string | null;
  lastFetchedCount: number | null;
  disableReason: string | null;
  connectedOrganizationCount: number;
}

interface LogEntry {
  id: string;
  registryCode: string;
  level: string;
  message: string;
  createdAt: string;
}

const toast = useToastStore();
const queryClient = useQueryClient();
const expanded = ref<Record<string, boolean>>({ europe: true });
const selectedCode = ref<string | null>('BOIP');
const disableTarget = ref<RegisterCatalogRecord | null>(null);
const disableReason = ref('');
const busyCode = ref<string | null>(null);
const apiKeyDraft = ref<Record<string, string>>({});
const probeBanner = ref<{ code: string; tone: 'success' | 'warning' | 'danger'; title: string; body: string } | null>(
  null,
);

const CONTINENT_ORDER: RegisterContinent[] = [
  'europe',
  'international',
  'north_america',
  'south_america',
  'africa',
  'asia',
  'oceania',
];

const cockpitQuery = useQuery({
  queryKey: ['platform', 'register-catalog', 'cockpit'],
  queryFn: async () =>
    apiRequest<{
      registers: readonly RegisterCatalogRecord[];
      runtime: readonly RuntimeState[];
      logs: readonly LogEntry[];
    }>('/api/platform/register-catalog/cockpit'),
});

const runtimeByCode = computed(() => {
  const map = new Map<string, RuntimeState>();
  for (const r of cockpitQuery.data.value?.runtime ?? []) map.set(r.registryCode, r);
  return map;
});

const groups = computed(() => {
  const registers = sortRegistersByPriority(cockpitQuery.data.value?.registers ?? []);
  return CONTINENT_ORDER.map((continent) => ({
    continent,
    labelNl: CONTINENT_LABELS_NL[continent],
    registers: registers.filter((r) => (r.continent ?? 'europe') === continent),
  })).filter((g) => g.registers.length > 0);
});

const selectedLogs = computed(() => {
  const all = cockpitQuery.data.value?.logs ?? [];
  if (!selectedCode.value) return all.slice(0, 40);
  return all.filter((l) => l.registryCode === selectedCode.value);
});

const selectedRuntime = computed(() =>
  selectedCode.value ? runtimeByCode.value.get(selectedCode.value) ?? null : null,
);

const STATUS_LABELS: Record<string, string> = {
  live: 'Live',
  coming_soon: 'Binnenkort',
  disabled: 'Uit',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  live: 'success',
  coming_soon: 'neutral',
  disabled: 'neutral',
};

/** Probe green + live — may turn “Register aan voor klanten” on (no enabledForWatch deadlock). */
function probeReady(row: RegisterCatalogRecord): boolean {
  const rt = runtimeByCode.value.get(row.code);
  return row.connectorStatus === 'live' && rt?.lastProbeStatus === 'ok';
}

function monitoringOk(row: RegisterCatalogRecord): boolean {
  return probeReady(row) && row.enabledForWatch;
}

function toggleContinent(c: string): void {
  expanded.value = { ...expanded.value, [c]: !expanded.value[c] };
}

async function saveApiKey(row: RegisterCatalogRecord): Promise<void> {
  const key = (apiKeyDraft.value[row.code] ?? '').trim();
  if (key.length < 4) {
    toast.error('Vul een API-sleutel in (minimaal 4 tekens).');
    return;
  }
  busyCode.value = row.code;
  try {
    await apiRequest(`/api/platform/register-catalog/${row.code}/credentials`, {
      method: 'POST',
      body: { apiKey: key },
    });
    apiKeyDraft.value = { ...apiKeyDraft.value, [row.code]: '' };
    await queryClient.invalidateQueries({ queryKey: ['platform', 'register-catalog', 'cockpit'] });
    toast.success(`API-sleutel opgeslagen voor ${row.displayNameNl}`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Opslaan mislukt');
  } finally {
    busyCode.value = null;
  }
}

async function testConnection(row: RegisterCatalogRecord): Promise<void> {
  busyCode.value = row.code;
  probeBanner.value = null;
  try {
    const result = await apiRequest<{
      success: boolean;
      messageNl: string;
      status: string;
    }>(`/api/platform/register-catalog/${row.code}/probe`, { method: 'POST' });
    await queryClient.invalidateQueries({ queryKey: ['platform', 'register-catalog', 'cockpit'] });
    probeBanner.value = {
      code: row.code,
      tone: result.success ? 'success' : 'warning',
      title: result.success ? 'Verbinding gelukt' : 'Verbinding mislukt',
      body: result.messageNl || result.status,
    };
    if (result.success) toast.success(`Verbinding met ${row.displayNameNl} gelukt`);
    else toast.error(result.messageNl || 'Verbinding mislukt');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Verbindingstest mislukt';
    probeBanner.value = { code: row.code, tone: 'danger', title: 'Verbinding mislukt', body: msg };
    toast.error(msg);
  } finally {
    busyCode.value = null;
  }
}

function openDisable(row: RegisterCatalogRecord): void {
  disableTarget.value = row;
  disableReason.value = '';
}

async function confirmDisable(): Promise<void> {
  if (!disableTarget.value || disableReason.value.trim().length < 3) return;
  const code = disableTarget.value.code;
  busyCode.value = code;
  try {
    await apiRequest(`/api/platform/register-catalog/${code}`, {
      method: 'PATCH',
      body: {
        connectorStatus: 'disabled',
        enabledForWatch: false,
        disableReason: disableReason.value.trim(),
      },
    });
    disableTarget.value = null;
    await queryClient.invalidateQueries({ queryKey: ['platform', 'register-catalog', 'cockpit'] });
    toast.success('Register uitgeschakeld; getroffen organisaties zijn genotificeerd');
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Uitschakelen mislukt');
  } finally {
    busyCode.value = null;
  }
}

async function setLive(row: RegisterCatalogRecord): Promise<void> {
  busyCode.value = row.code;
  try {
    await apiRequest(`/api/platform/register-catalog/${row.code}`, {
      method: 'PATCH',
      body: { connectorStatus: 'live' },
    });
    await queryClient.invalidateQueries({ queryKey: ['platform', 'register-catalog', 'cockpit'] });
    toast.success(`${row.displayNameNl} staat op live — test de verbinding en zet daarna aan voor klanten`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Opslaan mislukt');
  } finally {
    busyCode.value = null;
  }
}

async function toggleForCustomers(row: RegisterCatalogRecord): Promise<void> {
  const turningOn = !row.enabledForWatch;
  if (turningOn && !probeReady(row)) {
    toast.error('Eerst verbinding testen (groen) terwijl het register live staat.');
    return;
  }
  busyCode.value = row.code;
  try {
    if (!turningOn) {
      await apiRequest(`/api/platform/register-catalog/${row.code}`, {
        method: 'PATCH',
        body: {
          enabledForWatch: false,
          disableReason: 'Register uitgeschakeld voor klanten via platform',
        },
      });
    } else {
      await apiRequest(`/api/platform/register-catalog/${row.code}`, {
        method: 'PATCH',
        body: { enabledForWatch: true },
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['platform', 'register-catalog', 'cockpit'] });
    toast.success(
      turningOn
        ? `${row.displayNameNl} is aan voor klanten`
        : `${row.displayNameNl} is uit voor klanten`,
    );
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Opslaan mislukt');
  } finally {
    busyCode.value = null;
  }
}
</script>

<template>
  <PlatformPageHeader
    title="Registers en koppelingen"
    description="API-sleutel opslaan, verbinding testen, en per register bepalen of klanten het mogen gebruiken."
  >
    <MwBanner tone="info" title="Hoe werkt dit?">
      Per register: vul een API-sleutel in → klik Verbinding testen → zet Register aan voor klanten. Zonder groene
      test blijft bewaking uit en tonen klantmerken “Niet bewaakt — register offline”.
    </MwBanner>

    <div class="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div class="space-y-3">
        <MwCard
          v-for="group in groups"
          :key="group.continent"
          :padding="false"
          :title="group.labelNl"
        >
          <template #actions>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text"
              @click="toggleContinent(group.continent)"
            >
              <span
                class="inline-block transition-transform"
                :class="expanded[group.continent] ? 'rotate-90' : ''"
              >›</span>
              {{ group.registers.length }} registers
            </button>
          </template>
          <ul v-if="expanded[group.continent]" class="divide-y divide-border">
            <li
              v-for="row in group.registers"
              :key="row.code"
              class="px-4 py-3"
              :class="selectedCode === row.code && 'bg-accent-soft/20'"
            >
              <button type="button" class="w-full text-left" @click="selectedCode = row.code">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-medium text-text">{{ row.displayNameNl }}</p>
                    <p class="text-xs text-text-muted">{{ row.code }} · {{ row.regionNl }}</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <StatusBadge
                      :label="STATUS_LABELS[row.connectorStatus] ?? row.connectorStatus"
                      :tone="STATUS_TONES[row.connectorStatus] ?? 'neutral'"
                    />
                    <StatusBadge
                      v-if="monitoringOk(row)"
                      label="Aan voor klanten"
                      tone="success"
                    />
                    <StatusBadge
                      v-else-if="row.enabledForWatch"
                      label="Verbinding nodig"
                      tone="warning"
                    />
                  </div>
                </div>
              </button>

              <div v-if="selectedCode === row.code" class="mt-3 space-y-3 rounded-md border border-border bg-surface p-3">
                <MwBanner
                  v-if="probeBanner?.code === row.code"
                  :tone="probeBanner.tone"
                  :title="probeBanner.title"
                >
                  {{ probeBanner.body }}
                </MwBanner>

                <MwField :label="`API-sleutel (${row.displayNameNl})`" :for-id="`key-${row.code}`">
                  <div class="flex flex-col gap-2 sm:flex-row">
                    <input
                      :id="`key-${row.code}`"
                      v-model="apiKeyDraft[row.code]"
                      type="password"
                      autocomplete="off"
                      class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      :placeholder="
                        runtimeByCode.get(row.code)?.apiKeyConfigured
                          ? `Geconfigureerd (····${runtimeByCode.get(row.code)?.apiKeyLast4 ?? '????'}) — nieuwe sleutel plakken om te vervangen`
                          : 'Plak hier de API-sleutel'
                      "
                    />
                    <MwButton
                      size="sm"
                      variant="secondary"
                      :loading="busyCode === row.code"
                      @click="saveApiKey(row)"
                    >
                      Opslaan
                    </MwButton>
                  </div>
                  <p v-if="runtimeByCode.get(row.code)?.apiKeyConfigured" class="mt-1 text-xs text-text-muted">
                    Sleutel geconfigureerd · eindigt op
                    {{ runtimeByCode.get(row.code)?.apiKeyLast4 ?? '????' }}
                  </p>
                </MwField>

                <div class="flex flex-wrap items-center gap-2">
                  <MwButton
                    size="sm"
                    variant="primary"
                    :loading="busyCode === row.code"
                    @click="testConnection(row)"
                  >
                    Verbinding testen
                  </MwButton>
                  <MwButton
                    v-if="row.connectorStatus !== 'live'"
                    size="sm"
                    variant="secondary"
                    @click="setLive(row)"
                  >
                    Zet op live
                  </MwButton>
                  <MwButton
                    v-if="row.connectorStatus !== 'disabled'"
                    size="sm"
                    variant="secondary"
                    @click="openDisable(row)"
                  >
                    Register uitschakelen
                  </MwButton>
                </div>

                <label class="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <span>
                    <span class="font-medium text-text">Register aan voor klanten</span>
                    <span class="mt-0.5 block text-xs text-text-muted">
                      Alleen na groene verbindingstest. Uit = merken tonen “register offline”.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    class="h-4 w-4 accent-accent-strong"
                    :checked="row.enabledForWatch"
                    :disabled="busyCode === row.code || (!row.enabledForWatch && !probeReady(row))"
                    @change="toggleForCustomers(row)"
                  />
                </label>

                <p
                  v-if="runtimeByCode.get(row.code)?.lastProbeMessage"
                  class="text-xs text-text-muted"
                >
                  Laatste test:
                  {{ runtimeByCode.get(row.code)?.lastProbeMessage }}
                  <span v-if="runtimeByCode.get(row.code)?.lastProbeAt">
                    · {{ formatDateTime(runtimeByCode.get(row.code)!.lastProbeAt!) }}
                  </span>
                </p>
              </div>
            </li>
          </ul>
        </MwCard>
      </div>

      <div class="space-y-3">
        <MwCard title="Status">
          <template v-if="selectedCode && selectedRuntime">
            <dl class="grid gap-2 text-sm">
              <div class="flex justify-between gap-2">
                <dt class="text-text-muted">Register</dt>
                <dd class="font-medium">{{ selectedCode }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-text-muted">API-sleutel</dt>
                <dd>
                  {{
                    selectedRuntime.apiKeyConfigured
                      ? `Geconfigureerd (····${selectedRuntime.apiKeyLast4 ?? '????'})`
                      : 'Niet gezet'
                  }}
                </dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-text-muted">Laatste test</dt>
                <dd>{{ selectedRuntime.lastProbeAt ? formatDateTime(selectedRuntime.lastProbeAt) : '—' }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-text-muted">Aangesloten orgs</dt>
                <dd>{{ selectedRuntime.connectedOrganizationCount }}</dd>
              </div>
              <div v-if="selectedRuntime.disableReason" class="rounded-md bg-surface-muted px-2 py-1.5 text-warning">
                {{ selectedRuntime.disableReason }}
              </div>
            </dl>
          </template>
          <p v-else class="text-sm text-text-muted">Selecteer een register links.</p>
        </MwCard>

        <MwCard title="Logboek">
          <div
            class="max-h-80 overflow-y-auto rounded-md bg-zinc-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-200"
          >
            <p v-for="log in selectedLogs" :key="log.id" class="whitespace-pre-wrap">
              <span class="text-zinc-500">{{ formatDateTime(log.createdAt) }}</span>
              <span
                class="ml-2"
                :class="{
                  'text-amber-300': log.level === 'warn',
                  'text-red-400': log.level === 'error',
                  'text-emerald-300': log.level === 'info',
                }"
              >[{{ log.level }}]</span>
              <span class="ml-1 text-zinc-400">{{ log.registryCode }}</span>
              {{ log.message }}
            </p>
            <p v-if="!selectedLogs.length" class="text-zinc-500">Nog geen logregels.</p>
          </div>
        </MwCard>
      </div>
    </div>

    <ConfirmDialog
      :open="disableTarget !== null"
      title="Register uitschakelen"
      confirm-label="Uitschakelen"
      tone="danger"
      :busy="busyCode === disableTarget?.code"
      @confirm="confirmDisable"
      @cancel="disableTarget = null"
    >
      <p class="mb-3 text-sm text-text-muted">
        {{ disableTarget?.displayNameNl }} — organisaties met actieve bewaking krijgen een duidelijke melding
        waarom hun merken niet meer bewaakt worden.
      </p>
      <MwField label="Reden" for-id="disable-reason" required>
        <textarea id="disable-reason" v-model="disableReason" rows="3" class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" />
      </MwField>
    </ConfirmDialog>
  </PlatformPageHeader>
</template>
