import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

let toastSeq = 0;

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([]);

  function push(input: Omit<ToastItem, 'id'> & { durationMs?: number }): string {
    const id = `toast-${++toastSeq}`;
    const item: ToastItem = {
      id,
      message: input.message,
      tone: input.tone,
      actionLabel: input.actionLabel,
      onAction: input.onAction,
    };
    items.value = [...items.value, item];
    const duration = input.durationMs ?? 4200;
    if (duration > 0) {
      window.setTimeout(() => dismiss(id), duration);
    }
    return id;
  }

  function success(message: string, opts?: { actionLabel?: string; onAction?: () => void }): string {
    return push({ message, tone: 'success', ...opts });
  }

  function error(message: string, opts?: { actionLabel?: string; onAction?: () => void; durationMs?: number }): string {
    return push({ message, tone: 'error', durationMs: 7000, ...opts });
  }

  function info(message: string): string {
    return push({ message, tone: 'info' });
  }

  function warning(message: string): string {
    return push({ message, tone: 'warning' });
  }

  function dismiss(id: string): void {
    items.value = items.value.filter((t) => t.id !== id);
  }

  return { items, push, success, error, info, warning, dismiss };
});
