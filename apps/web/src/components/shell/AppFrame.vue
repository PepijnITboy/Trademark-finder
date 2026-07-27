<script setup lang="ts">
import type { NavConfig } from './nav-types';
import AppSidebar from './AppSidebar.vue';
import AppTopbar from './AppTopbar.vue';
import ToastHost from '../toast/ToastHost.vue';

defineProps<{ config: NavConfig }>();
</script>

<template>
  <div class="flex min-h-screen bg-background text-text">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent-strong focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
    >
      Ga naar hoofdinhoud
    </a>
    <AppSidebar :config="config" />
    <div class="flex min-w-0 flex-1 flex-col">
      <AppTopbar :label="config.topbarLabel" :badge="config.badge">
        <template v-if="$slots.topbarActions" #actions>
          <slot name="topbarActions" />
        </template>
      </AppTopbar>
      <main id="main-content" tabindex="-1" class="flex-1 overflow-y-auto p-6 focus:outline-none sm:p-8">
        <RouterView />
      </main>
    </div>
    <ToastHost />
  </div>
</template>
