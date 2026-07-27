<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue';
import MwCard from '../../components/MwCard.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <PlatformPageHeader
    title="AI en kosten"
    description="Verbruik en kosten van de AI-plausibiliteitscorrectie die de scoringspijplijn optioneel aanvult."
  >
    <MwCard>
      <EmptyState
        :dashed="false"
        title="AI-kostenmonitoring nog niet gekoppeld"
        description="Maandelijks verbruik, budgetdrempels en de status van 'ai_budget_exhausted'-meldingen worden hier zichtbaar zodra de AI-verrijkingslaag kostenregistratie rapporteert aan het platform."
      />
    </MwCard>
  </PlatformPageHeader>
</template>
