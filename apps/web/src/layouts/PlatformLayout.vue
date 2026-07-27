<script setup lang="ts">
import { useRoute } from 'vue-router';
import StatusBadge from '../components/StatusBadge.vue';
import ThemeToggle from '../components/ThemeToggle.vue';

interface NavItem {
  label: string;
  to: string;
}

const navItems: NavItem[] = [
  { label: 'Platformoverzicht', to: '/platform/overzicht' },
  { label: 'Klanten', to: '/platform/klanten' },
  { label: 'Accounts', to: '/platform/accounts' },
  { label: 'Abonnementen', to: '/platform/abonnementen' },
  { label: 'Registers en koppelingen', to: '/platform/registers' },
  { label: 'Imports en verwerking', to: '/platform/imports' },
  { label: 'Matches en scoring', to: '/platform/matches-scoring' },
  { label: 'AI en kosten', to: '/platform/ai-kosten' },
  { label: 'Jobs en fouten', to: '/platform/jobs-fouten' },
  { label: 'Notificaties', to: '/platform/notificaties' },
  { label: 'Exports en opslag', to: '/platform/exports' },
  { label: 'Systeeminstellingen', to: '/platform/systeeminstellingen' },
  { label: 'Auditlog', to: '/platform/auditlog' },
];

const route = useRoute();

/** True for the nav item's own route and any of its nested/detail routes. */
function isNavItemActive(item: NavItem): boolean {
  return route.path === item.to || route.path.startsWith(`${item.to}/`);
}
</script>

<template>
  <div class="flex min-h-screen bg-background text-text">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent-strong focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
    >
      Ga naar hoofdinhoud
    </a>
    <aside class="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div class="space-y-2 border-b border-border px-6 py-5">
        <p class="text-sm font-semibold tracking-wide text-text">Merkwacht</p>
        <span
          class="inline-block rounded-full bg-accent-strong px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white"
        >
          Platformbeheer
        </span>
      </div>
      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Hoofdnavigatie">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          custom
          v-slot="{ href, navigate }"
        >
          <a
            :href="href"
            class="block rounded-md px-3 py-2 text-sm text-text-muted hover:bg-surface-muted hover:text-text"
            :class="isNavItemActive(item) && 'bg-accent-soft font-medium text-accent-strong hover:bg-accent-soft'"
            :aria-current="isNavItemActive(item) ? 'page' : undefined"
            @click="navigate"
          >
            {{ item.label }}
          </a>
        </RouterLink>
      </nav>
      <div class="border-t border-border px-3 py-4">
        <ThemeToggle />
      </div>
    </aside>
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
        <p class="text-sm text-text-muted">Interne beheeromgeving</p>
        <StatusBadge label="Platformbeheer" tone="accent" />
      </header>
      <main id="main-content" tabindex="-1" class="flex-1 overflow-y-auto p-6 focus:outline-none">
        <RouterView />
      </main>
    </div>
  </div>
</template>
