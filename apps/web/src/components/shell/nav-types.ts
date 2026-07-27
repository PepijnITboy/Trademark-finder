/** Shared navigation config for customer and platform shells. */

export type NavIconName =
  | 'home'
  | 'matches'
  | 'marks'
  | 'deadline'
  | 'archive'
  | 'org'
  | 'subscription'
  | 'settings'
  | 'platform'
  | 'customers'
  | 'accounts'
  | 'registers'
  | 'imports'
  | 'scoring'
  | 'ai'
  | 'jobs'
  | 'notifications'
  | 'exports'
  | 'system'
  | 'audit';

export interface NavLeaf {
  type: 'leaf';
  id: string;
  label: string;
  to: string;
  icon?: NavIconName;
  /** Match nested detail routes under this path. */
  matchPrefix?: string;
}

export interface NavGroup {
  type: 'group';
  id: string;
  label: string;
  icon: NavIconName;
  /** Optional default route when clicking the parent label. */
  to?: string;
  children: NavLeaf[];
  defaultOpen?: boolean;
}

export type NavEntry = NavLeaf | NavGroup;

export interface NavConfig {
  brandTitle: string;
  brandSubtitle?: string;
  badge?: string;
  topbarLabel: string;
  storageKey: string;
  entries: NavEntry[];
  footer?: NavLeaf[];
}
