<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import MwBanner from '../../components/MwBanner.vue';
import MwButton from '../../components/MwButton.vue';
import MwCard from '../../components/MwCard.vue';
import MwField from '../../components/MwField.vue';
import MwSelect from '../../components/MwSelect.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import { apiRequest } from '../../api/client';
import { formatDateTime } from '../../lib/format';
import { useToastStore } from '../../stores/toast';
import PlatformPageHeader from './PlatformPageHeader.vue';

interface ProviderRuntime {
  provider: 'openai' | 'anthropic' | 'google';
  configured: boolean;
  last4: string | null;
  lastTestStatus: 'ok' | 'fail' | null;
  lastTestMessageNl: string | null;
  lastTestAt: string | null;
}

interface SettingsView {
  activeProvider: 'openai' | 'anthropic' | 'google' | 'none';
  providers: readonly ProviderRuntime[];
  resolve: { enrichmentAvailable: boolean; reasonNl: string };
}

const toast = useToastStore();
const queryClient = useQueryClient();
const busy = ref<string | null>(null);
const drafts = ref<Record<string, string>>({});

const settingsQuery = useQuery({
  queryKey: ['platform', 'ai', 'providers'],
  queryFn: async () => {
    const res = await apiRequest<{ settings: SettingsView }>('/api/platform/ai/providers');
    return res.settings;
  },
});

const costsQuery = useQuery({
  queryKey: ['platform', 'ai', 'costs'],
  queryFn: async () =>
    apiRequest<{
      monthlyBudgetEur: number;
      customers: readonly { customerId: string; customerName: string; budget: { status: string; usedEur: number } }[];
    }>('/api/platform/ai/costs'),
});

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  none: 'Uit (geen AI)',
};

const activeOptions = computed(() => [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'none', label: 'Uit (geen AI)' },
]);

async function setActive(provider: string): Promise<void> {
  busy.value = 'active';
  try {
    await apiRequest('/api/platform/ai/providers/active', {
      method: 'PUT',
      body: { provider },
    });
    await queryClient.invalidateQueries({ queryKey: ['platform', 'ai', 'providers'] });
    toast.success(`Actieve AI-provider: ${PROVIDER_LABELS[provider] ?? provider}`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Opslaan mislukt');
  } finally {
    busy.value = null;
  }
}

async function saveKey(provider: string): Promise<void> {
  const apiKey = (drafts.value[provider] ?? '').trim();
  if (apiKey.length < 8) {
    toast.error('Vul een API-sleutel in (minimaal 8 tekens).');
    return;
  }
  busy.value = provider;
  try {
    await apiRequest(`/api/platform/ai/providers/${provider}/key`, {
      method: 'POST',
      body: { apiKey },
    });
    drafts.value = { ...drafts.value, [provider]: '' };
    await queryClient.invalidateQueries({ queryKey: ['platform', 'ai', 'providers'] });
    toast.success(`Sleutel opgeslagen voor ${PROVIDER_LABELS[provider]}`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Opslaan mislukt');
  } finally {
    busy.value = null;
  }
}

async function testProvider(provider: string): Promise<void> {
  busy.value = `test-${provider}`;
  try {
    const result = await apiRequest<{ success: boolean; messageNl: string }>(
      `/api/platform/ai/providers/${provider}/test`,
      { method: 'POST' },
    );
    await queryClient.invalidateQueries({ queryKey: ['platform', 'ai', 'providers'] });
    if (result.success) toast.success(result.messageNl);
    else toast.error(result.messageNl);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Test mislukt');
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <PlatformPageHeader
    title="Koppelingen AI"
    description="Provider-sleutels voor OpenAI, Anthropic en Google. Sleutels blijven server-side; de UI toont alleen geconfigureerd + laatste 4 tekens."
  >
    <MwBanner
      v-if="settingsQuery.data.value"
      :tone="settingsQuery.data.value.resolve.enrichmentAvailable ? 'success' : 'info'"
      :title="settingsQuery.data.value.resolve.enrichmentAvailable ? 'AI-verrijking actief' : 'Scoring zonder AI'"
    >
      {{ settingsQuery.data.value.resolve.reasonNl }}
    </MwBanner>

    <MwCard title="Actieve provider">
      <MwField label="Gebruik voor scoring" for-id="ai-active">
        <MwSelect
          id="ai-active"
          :model-value="settingsQuery.data.value?.activeProvider ?? 'openai'"
          :options="activeOptions"
          @update:model-value="(v) => setActive(String(v))"
        />
      </MwField>
    </MwCard>

    <div class="grid gap-4 lg:grid-cols-3">
      <MwCard
        v-for="p in settingsQuery.data.value?.providers ?? []"
        :key="p.provider"
        :title="PROVIDER_LABELS[p.provider]"
      >
        <p class="mb-2 text-xs text-text-muted">
          {{
            p.configured
              ? `Geconfigureerd (····${p.last4 ?? '????'})`
              : 'Nog geen sleutel'
          }}
        </p>
        <MwField :label="`API-sleutel ${PROVIDER_LABELS[p.provider]}`" :for-id="`ai-key-${p.provider}`">
          <input
            :id="`ai-key-${p.provider}`"
            v-model="drafts[p.provider]"
            type="password"
            autocomplete="off"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Plak nieuwe sleutel…"
          />
        </MwField>
        <div class="mt-3 flex flex-wrap gap-2">
          <MwButton
            size="sm"
            variant="secondary"
            :loading="busy === p.provider"
            @click="saveKey(p.provider)"
          >
            Opslaan
          </MwButton>
          <MwButton
            size="sm"
            variant="primary"
            :loading="busy === `test-${p.provider}`"
            @click="testProvider(p.provider)"
          >
            Verbinding testen
          </MwButton>
        </div>
        <p v-if="p.lastTestMessageNl" class="mt-2 text-xs text-text-muted">
          <StatusBadge
            :label="p.lastTestStatus === 'ok' ? 'Oké' : 'Mislukt'"
            :tone="p.lastTestStatus === 'ok' ? 'success' : 'warning'"
          />
          {{ p.lastTestMessageNl }}
          <span v-if="p.lastTestAt"> · {{ formatDateTime(p.lastTestAt) }}</span>
        </p>
      </MwCard>
    </div>

    <MwCard title="Kostenoverzicht">
      <p class="mb-3 text-sm text-text-muted">
        Maandbudget: € {{ costsQuery.data.value?.monthlyBudgetEur ?? '—' }}
      </p>
      <ul v-if="costsQuery.data.value?.customers?.length" class="divide-y divide-border text-sm">
        <li
          v-for="c in costsQuery.data.value.customers"
          :key="c.customerId"
          class="flex justify-between gap-2 py-2"
        >
          <span>{{ c.customerName }}</span>
          <span class="tabular-nums text-text-muted">
            € {{ c.budget.usedEur.toFixed(2) }} · {{ c.budget.status }}
          </span>
        </li>
      </ul>
      <p v-else class="text-sm text-text-muted">Nog geen kostenregistratie.</p>
    </MwCard>
  </PlatformPageHeader>
</template>
