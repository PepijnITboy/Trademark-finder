<script setup lang="ts">
import EmptyState from '../../components/EmptyState.vue';
import PlatformPageHeader from './PlatformPageHeader.vue';
</script>

<template>
  <div class="space-y-6">
    <PlatformPageHeader
      title="Auditlog"
      description="Onveranderlijk logboek van gevoelige acties: statuswijzigingen, exports en toegang tot klantgegevens."
    />
    <EmptyState
      title="Auditlog nog niet gekoppeld"
      description="Een doorzoekbaar logboek van wie, wat en wanneer verschijnt hier zodra platformacties worden weggeschreven naar een auditlog-API. Zie docs/security/security-model.md voor de beoogde reikwijdte."
    />
  </div>
</template>
