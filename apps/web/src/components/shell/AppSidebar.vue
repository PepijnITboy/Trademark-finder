<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useMatches } from '../../api/matches';
import { useOrganizationProfile } from '../../api/organization';
import type { NavConfig, NavLeaf } from './nav-types';
import NavGroup from './NavGroup.vue';
import NavLink from './NavLink.vue';
import { useNavOpenState } from './useNavOpenState';

const props = defineProps<{ config: NavConfig }>();

const route = useRoute();
const path = computed(() => route.path);
const { isOpen, toggle, entries } = useNavOpenState(props.config, path);

const possibleQuery = useMatches({ queue: 'possible' });
const possibleCount = computed(() => possibleQuery.data.value?.length ?? 0);
const profileQuery = useOrganizationProfile();
const orgName = computed(() => profileQuery.data.value?.legalName ?? 'Organisatie');

const orgMenuOpen = ref(false);
const orgRoot = ref<HTMLElement | null>(null);

function toggleOrgMenu(): void {
  orgMenuOpen.value = !orgMenuOpen.value;
}

function closeOrgMenu(): void {
  orgMenuOpen.value = false;
}

function onDocClick(event: MouseEvent): void {
  if (!orgRoot.value?.contains(event.target as Node)) closeOrgMenu();
}

onMounted(() => document.addEventListener('mousedown', onDocClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick));

function leafWithBadge(item: NavLeaf): NavLeaf & { badgeCount?: number } {
  if (item.id === 'matches-mogelijk' && possibleCount.value > 0) {
    return { ...item, badgeCount: possibleCount.value };
  }
  return item;
}
</script>

<template>
  <aside class="flex w-[15.5rem] shrink-0 flex-col border-r border-border bg-sidebar">
    <div class="border-b border-border px-4 py-5">
      <p class="text-[0.9375rem] font-semibold tracking-wide text-text">{{ config.brandTitle }}</p>
      <p v-if="config.brandSubtitle" class="mt-0.5 text-xs text-text-muted">{{ config.brandSubtitle }}</p>
      <span
        v-if="config.badge"
        class="mt-2 inline-flex rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-strong"
      >
        {{ config.badge }}
      </span>
    </div>

    <nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-3" aria-label="Hoofdnavigatie">
      <template v-for="entry in entries" :key="entry.id">
        <NavLink v-if="entry.type === 'leaf'" :item="entry" :path="path" />
        <NavGroup
          v-else
          :group="entry"
          :path="path"
          :open="isOpen(entry)"
          :badge-for="leafWithBadge"
          @toggle="toggle(entry)"
        />
      </template>
    </nav>

    <div v-if="config.footer?.length" ref="orgRoot" class="relative mt-auto shrink-0 border-t border-border bg-sidebar px-2.5 py-3">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-text transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        :aria-expanded="orgMenuOpen"
        aria-haspopup="menu"
        aria-controls="org-menu"
        aria-label="Organisatiemenu"
        @click="toggleOrgMenu"
      >
        <span class="min-w-0 truncate">{{ orgName }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="h-4 w-4 shrink-0 text-text-muted transition-transform"
          :class="orgMenuOpen && 'rotate-180'"
          aria-hidden="true"
        >
          <path d="M4 10 8 6 12 10" />
        </svg>
      </button>

      <div
        v-if="orgMenuOpen"
        id="org-menu"
        role="menu"
        class="absolute bottom-full left-2 right-2 z-30 mb-1 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
      >
        <RouterLink
          v-for="item in config.footer"
          :key="item.id"
          :to="item.to"
          role="menuitem"
          class="block px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          @click="closeOrgMenu"
        >
          {{ item.label }}
        </RouterLink>
      </div>
    </div>
  </aside>
</template>
