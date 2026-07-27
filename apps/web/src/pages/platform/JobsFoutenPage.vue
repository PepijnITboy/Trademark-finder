<script setup lang="ts">
import { JOB_TYPES } from '@merkwacht/domain';
import EmptyState from '../../components/EmptyState.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <div class="space-y-6">
    <PlatformPageHeader
      title="Jobs en fouten"
      description="Uitvoeringsstatus en foutmeldingen van de achtergrondtaken in de dagelijkse verwerkingspijplijn."
    />

    <div class="rounded-lg border border-border bg-surface p-5">
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">Bekende taaktypes</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <StatusBadge v-for="type in JOB_TYPES" :key="type" :label="type" tone="neutral" />
      </div>
    </div>

    <EmptyState
      title="Taakoverzicht nog niet gekoppeld"
      description="Een overzicht van elke jobrun met status, duur en foutmelding volgt zodra de worker zijn processing_job-audittrail blootstelt via een platform-API."
    >
      <p class="text-xs text-text-muted">
        Interne taken worden aangestuurd via <code class="rounded bg-surface-muted px-1 py-0.5">/internal/jobs</code>,
        beveiligd met een gedeeld geheim en niet bedoeld voor gebruik vanuit deze interface.
      </p>
    </EmptyState>
  </div>
</template>
