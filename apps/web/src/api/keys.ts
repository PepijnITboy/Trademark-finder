/** Central vue-query key factory, so invalidation stays consistent across composables. */
export const queryKeys = {
  dashboard: ['dashboard'] as const,
  watchedTrademarks: {
    all: ['watched-trademarks'] as const,
    detail: (id: string) => ['watched-trademarks', id] as const,
  },
  matches: {
    all: (status?: string) => ['matches', status ?? 'ALL'] as const,
    detail: (id: string) => ['matches', 'detail', id] as const,
  },
  deadlines: ['deadlines'] as const,
  archive: ['archive'] as const,
  registerSources: ['register-sources'] as const,
  notifications: ['notifications'] as const,
  settings: ['settings'] as const,
  platformHealth: ['platform', 'health'] as const,
};
