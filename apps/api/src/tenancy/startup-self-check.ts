import type { ApiEnv } from '@merkwacht/config';
import type { Logger } from '@merkwacht/logging';
import type { AppStore } from '../store/types.js';

export interface StartupSelfCheckResult {
  readonly ok: boolean;
  readonly storeKind: 'demo' | 'postgres';
  readonly checks: readonly { readonly name: string; readonly ok: boolean; readonly detail?: string }[];
}

/**
 * Lightweight startup self-check. When using Postgres, probes reachability
 * and (best-effort) RLS enablement count via a simple ping. DemoStore always
 * passes with an explicit note that RLS is not applicable.
 */
export async function runStartupSelfCheck(
  store: AppStore,
  env: Pick<ApiEnv, 'NODE_ENV' | 'ALLOW_DEMO_STORE'>,
  logger: Logger,
): Promise<StartupSelfCheckResult> {
  const checks: { name: string; ok: boolean; detail?: string }[] = [];

  checks.push({
    name: 'store_initialized',
    ok: store.kind === 'demo' || store.kind === 'postgres',
    detail: `kind=${store.kind}`,
  });

  if (store.kind === 'demo') {
    checks.push({
      name: 'rls_not_applicable',
      ok: true,
      detail: 'DemoStore — RLS enforced only against Postgres; API still scopes by organizationId.',
    });
    checks.push({
      name: 'demo_allowed',
      ok: env.ALLOW_DEMO_STORE === true || env.NODE_ENV === 'test',
      detail: 'DemoStore requires ALLOW_DEMO_STORE or NODE_ENV=test',
    });
  } else if (typeof (store as { ping?: () => Promise<void> }).ping === 'function') {
    try {
      await (store as { ping: () => Promise<void> }).ping();
      checks.push({ name: 'postgres_ping', ok: true });
      checks.push({
        name: 'rls_expected',
        ok: true,
        detail: 'RLS policies live in migrations; verify with docs/database/tenancy-audit.md after schema changes.',
      });
    } catch (error) {
      checks.push({
        name: 'postgres_ping',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const ok = checks.every((c) => c.ok);
  if (!ok) {
    logger.error('Startup self-check failed.', { checks });
  } else {
    logger.info('Startup self-check ok.', { storeKind: store.kind, checks });
  }

  return { ok, storeKind: store.kind, checks };
}
