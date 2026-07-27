<script setup lang="ts">
import type { NavGroup, NavLeaf } from './nav-types';
import NavIcon from './NavIcon.vue';
import NavLink from './NavLink.vue';
import { groupHasActiveChild } from './useNavOpenState';

const props = defineProps<{
  group: NavGroup;
  path: string;
  open: boolean;
  badgeFor?: (item: NavLeaf) => NavLeaf & { badgeCount?: number };
}>();

const emit = defineEmits<{ toggle: [] }>();

function childItem(item: NavLeaf): NavLeaf & { badgeCount?: number } {
  return props.badgeFor?.(item) ?? item;
}
</script>

<template>
  <div class="space-y-0.5">
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-pill px-3 py-2.5 text-left text-[0.9375rem] text-text-muted transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      :class="groupHasActiveChild(group, path) && !open && 'font-medium text-text'"
      :aria-expanded="open"
      :aria-controls="`nav-group-${group.id}`"
      @click="emit('toggle')"
    >
      <NavIcon :name="group.icon" class="text-current opacity-80" />
      <span class="min-w-0 flex-1 truncate font-medium">{{ group.label }}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-5 w-5 shrink-0 text-text-muted transition-transform duration-150"
        :class="open && 'rotate-90'"
        aria-hidden="true"
      >
        <path d="M7.5 4.5 12.5 10 7.5 15.5" />
      </svg>
    </button>

    <div
      v-show="open"
      :id="`nav-group-${group.id}`"
      class="ml-3 space-y-0.5 border-l border-border/80 pl-3"
      role="group"
      :aria-label="group.label"
    >
      <NavLink
        v-for="child in group.children"
        :key="child.id"
        :item="childItem(child)"
        :path="path"
        nested
      />
    </div>
  </div>
</template>
