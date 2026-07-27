import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    // Keep cache off the package node_modules tree (sandbox/CI friendly).
    cache: {
      dir: '/tmp/merkwacht-vitest-cache',
    },
  },
});
