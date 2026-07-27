import type { ApiEnv } from '@merkwacht/config';
import { createSupabaseAdminClient } from '@merkwacht/database';
import type { Logger } from '@merkwacht/logging';
import { createDemoStore } from './demo-store.js';
import { PostgresStore } from './postgres-store.js';
import type { AppStore } from './types.js';

/** How long the initial Postgres reachability probe may take before we give up and fall back to `DemoStore`. */
const PING_TIMEOUT_MS = 3000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Builds the `AppStore` the API uses for the lifetime of the process.
 * Prefers a real Postgres-backed store (via `@merkwacht/database`'s
 * service-role admin client), but performs a one-time reachability probe
 * at startup and falls back to the in-memory `DemoStore` when Supabase is
 * unreachable - so `pnpm dev` works without a local Supabase instance
 * running. This is a startup-time decision, not per-request: once chosen,
 * the store does not swap back automatically (a subsequent DB outage
 * should surface as a real 5xx, not silently serve stale demo data).
 */
export async function createAppStore(env: ApiEnv, logger: Logger): Promise<AppStore> {
  const client = createSupabaseAdminClient({
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const postgresStore = new PostgresStore(client);

  try {
    await withTimeout(postgresStore.ping(), PING_TIMEOUT_MS);
    logger.info('Postgres-database bereikbaar; PostgresStore actief.');
    return postgresStore;
  } catch (error) {
    logger.warn('Postgres-database niet bereikbaar; terugvallen op in-memory DemoStore.', {
      error: error instanceof Error ? error.message : String(error),
    });
    return createDemoStore();
  }
}
