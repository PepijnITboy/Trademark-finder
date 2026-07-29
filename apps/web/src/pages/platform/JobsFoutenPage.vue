<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import EmptyState from '../../components/EmptyState.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
import { apiRequest } from '../../api/client';

interface FunnelStage {
  code: string;
  entered: number;
  passed: number;
  dropped: number;
  dropRate: number;
  reasonCodes: Record<string, number>;
}

interface PipelineRun {
  id: string;
  runKind: string;
  registryCode: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  startVolume: number;
  endMatches: number;
  funnel: {
    stages: FunnelStage[];
    stuckStage?: string;
    lastError?: string;
  };
}

const selectedId = ref<string | null>(null);

const runsQuery = useQuery({
  queryKey: ['platform', 'pipeline-runs'],
  queryFn: () => apiRequest<{ runs: PipelineRun[] }>('/api/platform/pipeline-runs'),
});

const runs = computed(() => runsQuery.data.value?.runs ?? []);
const selected = computed(() => runs.value.find((r) => r.id === selectedId.value) ?? runs.value[0] ?? null);

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('nl-NL').format(n);
}
</script>

<template>
  <PlatformPageHeader
    title="Jobs en fouten"
    description="Pipeline-runs met funnel KPI’s: startvolume, drop% per stage, matches en hangpunten (scan én export)."
  >
    <MwCard title="Recente pipeline-runs">
      <div v-if="runsQuery.isLoading.value" class="text-sm text-text-muted">Laden…</div>
      <EmptyState
        v-else-if="runs.length === 0"
        :dashed="false"
        title="Nog geen runs"
        description="Zodra sync- of exportjobs draaien, verschijnen hier funnelstatistieken."
      />
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-text-muted">
            <tr>
              <th class="py-2 pr-3 font-medium">Soort</th>
              <th class="py-2 pr-3 font-medium">Register</th>
              <th class="py-2 pr-3 font-medium">Status</th>
              <th class="py-2 pr-3 font-medium">Start</th>
              <th class="py-2 pr-3 font-medium">Eindmatches</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="run in runs"
              :key="run.id"
              class="cursor-pointer border-t border-border hover:bg-surface-muted/40"
              :class="{ 'bg-surface-muted/60': selected?.id === run.id }"
              @click="selectedId = run.id"
            >
              <td class="py-2 pr-3">{{ run.runKind }}</td>
              <td class="py-2 pr-3">{{ run.registryCode ?? '—' }}</td>
              <td class="py-2 pr-3">
                <StatusBadge
                  :label="run.status"
                  :tone="run.status === 'succeeded' ? 'success' : run.status === 'failed' ? 'danger' : 'neutral'"
                />
              </td>
              <td class="py-2 pr-3">{{ formatNumber(run.startVolume) }}</td>
              <td class="py-2 pr-3">{{ formatNumber(run.endMatches) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </MwCard>

    <MwCard v-if="selected" title="Funnel detail">
      <p v-if="selected.funnel.stuckStage" class="mb-3 text-sm text-danger">
        Vastgelopen op stage <code>{{ selected.funnel.stuckStage }}</code>
        <span v-if="selected.funnel.lastError || selected.error">
          — {{ selected.funnel.lastError || selected.error }}
        </span>
      </p>
      <div class="space-y-2">
        <div
          v-for="stage in selected.funnel.stages"
          :key="stage.code"
          class="grid grid-cols-12 items-center gap-2 rounded border border-border px-3 py-2 text-sm"
        >
          <div class="col-span-3 font-medium">{{ stage.code }}</div>
          <div class="col-span-2 tabular-nums">in {{ formatNumber(stage.entered) }}</div>
          <div class="col-span-2 tabular-nums">door {{ formatNumber(stage.passed) }}</div>
          <div class="col-span-2 tabular-nums">af {{ formatNumber(stage.dropped) }}</div>
          <div class="col-span-3 tabular-nums text-text-muted">drop {{ pct(stage.dropRate) }}</div>
        </div>
      </div>
    </MwCard>
  </PlatformPageHeader>
</template>
