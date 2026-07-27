import type { JobStore } from '@merkwacht/database';
import type { Logger } from '@merkwacht/logging';
import type { TrademarkRegisterConnector } from '@merkwacht/register-connectors';
import type { AiEnrichmentPort } from '@merkwacht/scoring';

/**
 * Everything a pipeline (`daily-sync-pipeline.ts`,
 * `initial-opposition-scan-pipeline.ts`) needs to run: the shared
 * in-memory `JobStore` (or a future Postgres-backed equivalent satisfying
 * the same shape), one `TrademarkRegisterConnector` per supported
 * register, a scoped logger, and an optional AI enrichment implementation
 * (omitted entirely when `AI_PROVIDER=none` - see
 * `docs/scoring/ai-layer.md`). Constructed once per process in
 * `apps/worker/src/context.ts` and passed into every pipeline/handler
 * invocation, mirroring how `apps/api`'s `AppStore` is built once in
 * `app.ts`.
 */
export interface PipelineContext {
  readonly jobStore: JobStore;
  readonly logger: Logger;
  readonly connectors: ReadonlyMap<string, TrademarkRegisterConnector>;
  readonly ai?: AiEnrichmentPort;
}

/** Looks up the connector for `registryCode`, throwing a clear error if none is configured (a worker-side programming/config error, not a runtime connector failure - those are represented by `ConnectorConfigurationError` from within the connector itself). */
export function getConnector(context: PipelineContext, registryCode: string): TrademarkRegisterConnector {
  const connector = context.connectors.get(registryCode);
  if (!connector) {
    throw new Error(`Geen registerkoppeling geconfigureerd voor registercode "${registryCode}".`);
  }
  return connector;
}
