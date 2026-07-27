<script setup lang="ts">
import { useRoute } from 'vue-router';
import ThemeToggle from '../components/ThemeToggle.vue';

interface NavItem {
  label: string;
  to: string;
}

const navItems: NavItem[] = [
  { label: 'Overzicht', to: '/app/overzicht' },
  { label: 'Matches', to: '/app/matches' },
  { label: 'Bewaakte merken', to: '/app/bewaakte-merken' },
  { label: 'Deadlines', to: '/app/deadlines' },
  { label: 'Archief', to: '/app/archief' },
  { label: 'Organisatie en gebruikers', to: '/app/organisatie' },
  { label: 'Abonnement en verbruik', to: '/app/abonnement' },
  { label: 'Instellingen', to: '/app/instellingen' },
  { label: 'Databronnen', to: '/app/databronnen' },
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
      <div class="border-b border-border px-6 py-5">
        <p class="text-sm font-semibold tracking-wide text-text">Merkwacht</p>
        <p class="text-xs text-text-muted">Merkbewaking</p>
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
        <p class="text-sm text-text-muted">Klantomgeving</p>
      </header>
      <main id="main-content" tabindex="-1" class="flex-1 overflow-y-auto p-6 focus:outline-none">
        <RouterView />
      </main>
    </div>
  </div>
</template>
