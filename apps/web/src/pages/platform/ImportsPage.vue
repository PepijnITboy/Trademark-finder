<script setup lang="ts">
import { JOB_TYPES } from '@merkwacht/domain';
import EmptyState from '../../components/EmptyState.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';

const IMPORT_JOB_TYPES = JOB_TYPES.filter((type) => type !== 'send_notifications');
</script>

<template>
  <div class="space-y-6">
    <PlatformPageHeader
      title="Imports en verwerking"
      description="Voortgang en resultaten van de dagelijkse verwerkingspijplijn: ophalen, matchen en scoren van registerpublicaties."
    />

    <div class="rounded-lg border border-border bg-surface p-5">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Pijplijnstappen</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <StatusBadge v-for="type in IMPORT_JOB_TYPES" :key="type" :label="type" tone="neutral" />
      </div>
    </div>

    <EmptyState
      title="Importmonitoring nog niet gekoppeld"
      description="Per-run statistieken (aantal opgehaalde publicaties, verwerkingsduur, fouten per registerbron) verschijnen hier zodra de worker-pijplijn haar voortgang rapporteert aan een platform-API."
    />
  </div>
</template>
