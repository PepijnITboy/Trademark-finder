import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Note: Playwright specs in `e2e/` (see `test:e2e`) must never be picked up
// by Vitest (`test`/`test:unit`). Rather than adding a typed `test` option
// here - which would require importing `vitest/config`'s `defineConfig`
// and risks a Vite version-identity mismatch with `@vitejs/plugin-vue`'s
// `Plugin` type in a workspace with more than one installed Vite version -
// the exclusion is passed as a plain `--exclude` CLI flag in package.json.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
