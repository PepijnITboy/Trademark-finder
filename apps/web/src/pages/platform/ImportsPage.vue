<script setup lang="ts">
import { JOB_TYPES } from '@merkwacht/domain';
import EmptyState from '../../components/EmptyState.vue';
import MwCard from '../../components/MwCard.vue';
import StatusBadge from '../../components/StatusBadge.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';

const IMPORT_JOB_TYPES = JOB_TYPES.filter((type) => type !== 'send_notifications');
</script>

<template>
  <PlatformPageHeader
    title="Imports en verwerking"
    description="Voortgang en resultaten van de dagelijkse verwerkingspijplijn: ophalen, matchen en scoren van registerpublicaties."
  >
    <MwCard title="Pijplijnstappen">
      <div class="flex flex-wrap gap-2">
        <StatusBadge v-for="type in IMPORT_JOB_TYPES" :key="type" :label="type" tone="neutral" />
      </div>
    </MwCard>

    <MwCard>
      <EmptyState
        :dashed="false"
        title="Importmonitoring nog niet gekoppeld"
        description="Per-run statistieken (aantal opgehaalde publicaties, verwerkingsduur, fouten per registerbron) verschijnen hier zodra de worker-pijplijn haar voortgang rapporteert aan een platform-API."
      />
    </MwCard>
  </PlatformPageHeader>
</template>
