<script setup lang="ts">
import { platformNavConfig } from '../components/shell/nav-configs';
import AppFrame from '../components/shell/AppFrame.vue';
</script>

<template>
  <AppFrame :config="platformNavConfig" />
</template>
