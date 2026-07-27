<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue';
import MwCard from '../../components/MwCard.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <PlatformPageHeader
    title="Auditlog"
    description="Onveranderlijk logboek van gevoelige acties: statuswijzigingen, exports en toegang tot klantgegevens."
  >
    <MwCard>
      <EmptyState
        :dashed="false"
        title="Auditlog nog niet gekoppeld"
        description="Een doorzoekbaar logboek van wie, wat en wanneer verschijnt hier zodra platformacties worden weggeschreven naar een auditlog-API. Zie docs/security/security-model.md voor de beoogde reikwijdte."
      />
    </MwCard>
  </PlatformPageHeader>
</template>
