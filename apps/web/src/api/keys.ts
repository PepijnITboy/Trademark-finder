/** Central vue-query key factory, so invalidation stays consistent across composables. */
export const queryKeys = {
  dashboard: ['dashboard'] as const,
  watchedTrademarks: {
    all: ['watched-trademarks'] as const,
    detail: (id: string) => ['watched-trademarks', id] as const,
  },
  matches: {
    all: (scope?: string) => ['matches', scope ?? 'ALL'] as const,
    detail: (id: string) => ['matches', 'detail', id] as const,
  },
  deadlines: ['deadlines'] as const,
  archive: ['archive'] as const,
  registerSources: ['register-sources'] as const,
  notifications: ['notifications'] as const,
  settings: ['settings'] as const,
  organization: {
    profile: ['organization', 'profile'] as const,
    members: ['organization', 'members'] as const,
  },
  notificationRecipients: ['notification-recipients'] as const,
  subscription: {
    current: ['subscription'] as const,
    plans: ['subscription', 'plans'] as const,
  },
  invoices: ['invoices'] as const,
  chat: {
    threads: ['chat', 'threads'] as const,
    thread: (id: string) => ['chat', 'threads', id] as const,
  },
  platformHealth: ['platform', 'health'] as const,
  platformPlans: ['platform', 'plans'] as const,
  platformChatThreads: ['platform', 'chat', 'threads'] as const,
  platformBilling: ['platform', 'billing'] as const,
  nameResearch: {
    credits: ['name-research', 'credits'] as const,
    orders: ['name-research', 'orders'] as const,
    registers: ['name-research', 'registers'] as const,
  },
};
