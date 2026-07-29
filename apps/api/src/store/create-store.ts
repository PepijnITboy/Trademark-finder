import type { ApiEnv } from '@merkwacht/config';
import { createSupabaseAdminClient } from '@merkwacht/database';
import type { Logger } from '@merkwacht/logging';
import { createDemoStore } from './demo-store.js';
import { PostgresStore } from './postgres-store.js';
import type { AppStore } from './types.js';

/** How long the initial Postgres reachability probe may take before we give up. */
const PING_TIMEOUT_MS = 3000;

const PLACEHOLDER_KEY_PATTERN = /PASTE_|replace-with/i;

export function isPlaceholderServiceRoleKey(key: string | undefined | null): boolean {
  if (key == null) return true;
  const normalized = key.trim();
  if (!normalized) return true;
  return PLACEHOLDER_KEY_PATTERN.test(normalized);
}

/** True when the URL looks like a real hosted (or intentional) Supabase endpoint. */
export function looksLikeConfiguredSupabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      // Local Supabase CLI is a real target when a real service role is present.
      return true;
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isDemoStoreAllowed(env: Pick<ApiEnv, 'ALLOW_DEMO_STORE' | 'NODE_ENV'>): boolean {
  return env.ALLOW_DEMO_STORE === true || env.NODE_ENV === 'test';
}

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

export interface CreateAppStoreDeps {
  /** Override the reachability probe (for unit tests). */
  probe?: () => Promise<void>;
  createDemo?: () => AppStore;
  createPostgres?: (env: ApiEnv) => { ping(): Promise<void> } & AppStore;
}

/**
 * Builds the `AppStore` the API uses for the lifetime of the process.
 *
 * Fail-fast rules:
 * - Placeholder / missing service role + real-looking URL in development →
 *   clear error telling the operator to paste `service_role` (unless
 *   `ALLOW_DEMO_STORE=true`).
 * - Placeholder key otherwise → DemoStore only when `ALLOW_DEMO_STORE=true`
 *   or `NODE_ENV=test`.
 * - Real-looking credentials + failed probe → throw unless `ALLOW_DEMO_STORE=true`.
 */
export async function createAppStore(
  env: ApiEnv,
  logger: Logger,
  deps: CreateAppStoreDeps = {},
): Promise<AppStore> {
  const allowDemo = isDemoStoreAllowed(env);
  const placeholderKey = isPlaceholderServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY);
  const createDemo = deps.createDemo ?? (() => createDemoStore());

  if (placeholderKey) {
    if (env.NODE_ENV === 'development' && !allowDemo && looksLikeConfiguredSupabaseUrl(env.SUPABASE_URL)) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY staat nog op een placeholder (PASTE_… / replace-with-…). ' +
          'Plak de legacy service_role JWT uit het Supabase Dashboard (Project Settings → API), ' +
          'of zet ALLOW_DEMO_STORE=true om offline met DemoStore te draaien.',
      );
    }
    if (!allowDemo) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY ontbreekt of is een placeholder. ' +
          'Zet een echte service_role key, of ALLOW_DEMO_STORE=true / NODE_ENV=test voor DemoStore.',
      );
    }
    logger.warn('Service role key is placeholder/ontbreekt; DemoStore actief.', {
      allowDemoStore: env.ALLOW_DEMO_STORE === true,
      nodeEnv: env.NODE_ENV,
    });
    return createDemo();
  }

  const postgresStore =
    deps.createPostgres?.(env) ??
    new PostgresStore(
      createSupabaseAdminClient({
        supabaseUrl: env.SUPABASE_URL,
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      }),
    );

  const probe = deps.probe ?? (() => withTimeout(postgresStore.ping(), PING_TIMEOUT_MS));

  try {
    await probe();
    logger.info('Postgres-database bereikbaar; PostgresStore actief.');
    return postgresStore;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (allowDemo) {
      logger.warn('Postgres-database niet bereikbaar; terugvallen op in-memory DemoStore.', {
        error: message,
      });
      return createDemo();
    }
    throw new Error(
      `Supabase is geconfigureerd maar niet bereikbaar (probe faalde: ${message}). ` +
        'Herstel de verbinding/service_role, of zet ALLOW_DEMO_STORE=true voor offline DemoStore.',
    );
  }
}
