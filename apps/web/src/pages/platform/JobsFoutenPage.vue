<script setup lang="ts">
import { JOB_TYPES } from '@merkwacht/domain';
import EmptyState from '../../components/EmptyState.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <PlatformPageHeader
    title="Jobs en fouten"
    description="Uitvoeringsstatus en foutmeldingen van de achtergrondtaken in de dagelijkse verwerkingspijplijn."
  >
    <MwCard title="Bekende taaktypes">
      <div class="flex flex-wrap gap-2">
        <StatusBadge v-for="type in JOB_TYPES" :key="type" :label="type" tone="neutral" />
      </div>
    </MwCard>

    <MwCard>
      <EmptyState
        :dashed="false"
        title="Taakoverzicht nog niet gekoppeld"
        description="Een overzicht van elke jobrun met status, duur en foutmelding volgt zodra de worker zijn processing_job-audittrail blootstelt via een platform-API."
      >
        <p class="text-xs text-text-muted">
          Interne taken worden aangestuurd via <code class="rounded bg-surface-muted px-1 py-0.5">/internal/jobs</code>,
          beveiligd met een gedeeld geheim en niet bedoeld voor gebruik vanuit deze interface.
        </p>
      </EmptyState>
    </MwCard>
  </PlatformPageHeader>
</template>
