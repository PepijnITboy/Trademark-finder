import { computed, ref, watch, type Ref } from 'vue';
import type { NavConfig, NavEntry, NavGroup, NavLeaf } from './nav-types';

function readStored(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return normalizeSingleOpen(parsed as Record<string, boolean>);
    }
  } catch {
    /* ignore */
  }
  return {};
}

function writeStored(key: string, value: Record<string, boolean>): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Keep at most one group marked open in persisted state. */
function normalizeSingleOpen(map: Record<string, boolean>): Record<string, boolean> {
  const openIds = Object.entries(map)
    .filter(([, open]) => open)
    .map(([id]) => id);
  if (openIds.length <= 1) return map;
  const keep = openIds[openIds.length - 1]!;
  const next: Record<string, boolean> = {};
  for (const id of Object.keys(map)) {
    next[id] = id === keep;
  }
  return next;
}

function buildSingleOpenMap(entries: readonly NavEntry[], openId: string | null): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const entry of entries) {
    if (entry.type === 'group') {
      next[entry.id] = openId === entry.id;
    }
  }
  return next;
}

export function isLeafActive(leaf: NavLeaf, path: string): boolean {
  if (leaf.to === '/app/dashboard') {
    return (
      path === '/app/dashboard' ||
      path === '/app/overzicht' ||
      path.startsWith('/app/dashboard/') ||
      path.startsWith('/app/overzicht/')
    );
  }
  if (leaf.id === 'matches-actief') {
    if (path.startsWith('/app/matches/mogelijk')) return false;
    return path === '/app/matches' || path.startsWith('/app/matches/');
  }
  if (leaf.id === 'merkonderzoek-rapporten') {
    if (path.startsWith('/app/merkonderzoek/nieuw')) return false;
    return path === '/app/merkonderzoek' || path.startsWith('/app/merkonderzoek/');
  }
  const prefix = leaf.matchPrefix ?? leaf.to;
  return path === leaf.to || path.startsWith(`${prefix}/`);
}

export function groupHasActiveChild(group: NavGroup, path: string): boolean {
  return group.children.some((child) => isLeafActive(child, path));
}

function initialOpenMap(config: NavConfig): Record<string, boolean> {
  const stored = readStored(config.storageKey);
  if (Object.values(stored).some(Boolean)) return stored;

  let firstDefaultId: string | null = null;
  for (const entry of config.entries) {
    if (entry.type === 'group' && entry.defaultOpen) {
      firstDefaultId = entry.id;
      break;
    }
  }
  if (firstDefaultId) return buildSingleOpenMap(config.entries, firstDefaultId);
  return stored;
}

export function useNavOpenState(config: NavConfig, routePath: Ref<string>) {
  const openMap = ref<Record<string, boolean>>(initialOpenMap(config));
  const collapsedIds = ref<Set<string>>(new Set());

  function isOpen(group: NavGroup): boolean {
    if (collapsedIds.value.has(group.id)) return false;
    if (groupHasActiveChild(group, routePath.value)) return true;
    if (group.id in openMap.value) return openMap.value[group.id]!;
    return group.defaultOpen ?? false;
  }

  function toggle(group: NavGroup): void {
    const currentlyOpen = isOpen(group);

    if (currentlyOpen) {
      collapsedIds.value = new Set([...collapsedIds.value, group.id]);
      openMap.value = buildSingleOpenMap(config.entries, null);
    } else {
      const nextCollapsed = new Set(collapsedIds.value);
      nextCollapsed.delete(group.id);
      collapsedIds.value = nextCollapsed;
      openMap.value = buildSingleOpenMap(config.entries, group.id);
    }

    writeStored(config.storageKey, openMap.value);
  }

  watch(
    routePath,
    (path) => {
      for (const entry of config.entries) {
        if (entry.type === 'group' && groupHasActiveChild(entry, path)) {
          const nextCollapsed = new Set(collapsedIds.value);
          nextCollapsed.delete(entry.id);
          collapsedIds.value = nextCollapsed;
          openMap.value = buildSingleOpenMap(config.entries, entry.id);
          writeStored(config.storageKey, openMap.value);
          return;
        }
      }
    },
    { immediate: true },
  );

  const entries = computed(() => config.entries as NavEntry[]);

  return { isOpen, toggle, entries };
}
