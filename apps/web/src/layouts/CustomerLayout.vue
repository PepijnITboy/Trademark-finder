<script setup lang="ts">
import { customerNavConfig } from '../components/shell/nav-configs';
import AppFrame from '../components/shell/AppFrame.vue';
</script>

<template>
  <AppFrame :config="customerNavConfig" />
</template>
