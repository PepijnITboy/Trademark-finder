import { ref } from 'vue';

/**
 * Runs an optimistic UI update: apply local patch immediately, call the async
 * saver, and roll back + surface the error if the save fails.
 */
export async function withOptimisticSave<T>(options: {
  apply: () => void;
  rollback: () => void;
  save: () => Promise<T>;
  onError?: (error: unknown) => void;
}): Promise<{ ok: true; result: T } | { ok: false; error: unknown }> {
  options.apply();
  try {
    const result = await options.save();
    return { ok: true, result };
  } catch (error) {
    options.rollback();
    options.onError?.(error);
    return { ok: false, error };
  }
}

export function useOptimisticFlag() {
  const saving = ref(false);
  async function run<T>(fn: () => Promise<T>): Promise<T> {
    saving.value = true;
    try {
      return await fn();
    } finally {
      saving.value = false;
    }
  }
  return { saving, run };
}
