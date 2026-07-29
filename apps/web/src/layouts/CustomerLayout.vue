<script setup lang="ts">
import { customerNavConfig } from '../components/shell/nav-configs';
import AppFrame from '../components/shell/AppFrame.vue';
import NotificationBell from '../components/shell/NotificationBell.vue';
</script>

<template>
  <AppFrame :config="customerNavConfig">
    <template #topbarActions>
      <NotificationBell />
    </template>
  </AppFrame>
</template>
