<script setup lang="ts">
import type { NavIconName } from './nav-types';

defineProps<{ name: NavIconName; class?: string }>();
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    :class="['h-[18px] w-[18px] shrink-0', $props.class]"
  >
    <!-- home -->
    <template v-if="name === 'home'">
      <path d="M3.5 8.5 10 3l6.5 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-4V17H4.5a1 1 0 0 1-1-1V8.5Z" />
    </template>
    <!-- matches / layers -->
    <template v-else-if="name === 'matches'">
      <path d="M4 13.5 10 17l6-3.5M4 10l6 3.5L16 10M4 6.5 10 10l6-3.5L10 3 4 6.5Z" />
    </template>
    <!-- marks / tag -->
    <template v-else-if="name === 'marks'">
      <path d="M3.5 10.5V4.5A1 1 0 0 1 4.5 3.5h6l6 6-6.5 6.5-6.5-5.5Z" />
      <circle cx="7.25" cy="7.25" r="1" fill="currentColor" stroke="none" />
    </template>
    <!-- deadline / clock -->
    <template v-else-if="name === 'deadline'">
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10l2.5 1.5" />
    </template>
    <!-- archive -->
    <template v-else-if="name === 'archive'">
      <path d="M3.5 6.5h13v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-9Z" />
      <path d="M3 4.5h14v2H3v-2Z" />
      <path d="M8.5 10.5h3" />
    </template>
    <!-- org / users -->
    <template v-else-if="name === 'org' || name === 'customers' || name === 'accounts'">
      <circle cx="7.5" cy="7" r="2.25" />
      <circle cx="13.5" cy="7.5" r="1.75" />
      <path d="M3.5 15.5c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" />
      <path d="M12 12.2c1.5-.2 3.5.7 3.5 2.8" />
    </template>
    <!-- subscription -->
    <template v-else-if="name === 'subscription'">
      <rect x="3.5" y="5" width="13" height="10" rx="1.5" />
      <path d="M3.5 8.5h13" />
      <path d="M7 12.5h3" />
    </template>
    <!-- settings -->
    <template v-else-if="name === 'settings' || name === 'system'">
      <circle cx="10" cy="10" r="2.25" />
      <path
        d="M10 3.5v1.2M10 15.3v1.2M3.5 10h1.2M15.3 10h1.2M5.4 5.4l.85.85M13.75 13.75l.85.85M14.6 5.4l-.85.85M6.25 13.75l-.85.85"
      />
    </template>
    <!-- platform -->
    <template v-else-if="name === 'platform'">
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" />
      <rect x="11" y="3.5" width="5.5" height="5.5" rx="1" />
      <rect x="3.5" y="11" width="5.5" height="5.5" rx="1" />
      <rect x="11" y="11" width="5.5" height="5.5" rx="1" />
    </template>
    <!-- registers / plug -->
    <template v-else-if="name === 'registers'">
      <path d="M8 3.5v4M12 3.5v4M6.5 7.5h7v2.5l-1.5 1.5v5h-4v-5L6.5 10V7.5Z" />
    </template>
    <!-- imports -->
    <template v-else-if="name === 'imports'">
      <path d="M10 3.5v9" />
      <path d="M6.5 9.5 10 13l3.5-3.5" />
      <path d="M4 15.5h12" />
    </template>
    <!-- scoring -->
    <template v-else-if="name === 'scoring'">
      <path d="M4 15.5V9l3-2.5 3 4 3-5.5 3 4v6.5" />
    </template>
    <!-- ai -->
    <template v-else-if="name === 'ai'">
      <path d="M10 3.5 12 8l4.5.5-3.5 3.2 1 4.3L10 13.8 6 16l1-4.3L3.5 8.5 8 8l2-4.5Z" />
    </template>
    <!-- jobs -->
    <template v-else-if="name === 'jobs'">
      <path d="M6.5 7V5.5A1.5 1.5 0 0 1 8 4h4a1.5 1.5 0 0 1 1.5 1.5V7" />
      <rect x="3.5" y="7" width="13" height="9.5" rx="1.5" />
      <path d="M3.5 11h13" />
    </template>
    <!-- notifications -->
    <template v-else-if="name === 'notifications'">
      <path d="M10 16.5a1.5 1.5 0 0 0 1.5-1.5h-3A1.5 1.5 0 0 0 10 16.5Z" />
      <path d="M14.5 12.5V9a4.5 4.5 0 1 0-9 0v3.5L4 14.5h12l-1.5-2Z" />
    </template>
    <!-- exports -->
    <template v-else-if="name === 'exports'">
      <path d="M10 12.5V3.5" />
      <path d="M6.5 7 10 3.5 13.5 7" />
      <path d="M4 15.5h12" />
    </template>
    <!-- audit -->
    <template v-else-if="name === 'audit'">
      <path d="M6 3.5h6.5L15.5 6v10.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" />
      <path d="M12.5 3.5V6h2.5" />
      <path d="M7.5 10h5M7.5 13h5" />
    </template>
  </svg>
</template>
