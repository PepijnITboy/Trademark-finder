<script setup lang="ts">
import type { NavLeaf } from './nav-types';
import NavIcon from './NavIcon.vue';
import { isLeafActive } from './useNavOpenState';

const props = withDefaults(
  defineProps<{
    item: NavLeaf & { badgeCount?: number };
    path: string;
    nested?: boolean;
  }>(),
  { nested: false },
);

const active = () => isLeafActive(props.item, props.path);
</script>

<template>
  <RouterLink :to="item.to" custom v-slot="{ href, navigate }">
    <a
      :href="href"
      class="group flex items-center gap-2 rounded-pill text-[0.9375rem] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      :class="[
        nested ? 'py-2 pl-3 pr-3' : 'px-3 py-2.5',
        active()
          ? 'bg-nav-pill font-semibold text-text shadow-pill'
          : 'font-normal text-text-muted hover:bg-surface-hover hover:text-text',
      ]"
      :aria-current="active() ? 'page' : undefined"
      @click="navigate"
    >
      <NavIcon v-if="item.icon && !nested" :name="item.icon" class="text-current opacity-80" />
      <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
      <span
        v-if="item.badgeCount != null && item.badgeCount > 0"
        class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning/20 px-1.5 text-[11px] font-semibold text-warning"
      >
        {{ item.badgeCount }}
      </span>
    </a>
  </RouterLink>
</template>
