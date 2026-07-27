import { defineStore } from 'pinia';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'merkwacht:theme';

function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.setAttribute('data-theme', mode);
}

interface ThemeState {
  mode: ThemeMode;
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    mode: 'system',
  }),
  actions: {
    /** Reads the persisted preference (if any) and applies it to the document. */
    init(): void {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      this.mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
      applyTheme(this.mode);
    },
    setMode(mode: ThemeMode): void {
      this.mode = mode;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, mode);
      }
      applyTheme(mode);
    },
  },
});
