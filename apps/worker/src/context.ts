import { OpenAiAssessmentProvider } from '@merkwacht/ai';
import type { WorkerEnv } from '@merkwacht/config';
import { resolveAiProvider } from '@merkwacht/domain';
import { createJobStore, JobStore } from '@merkwacht/database';
import { createLogger } from '@merkwacht/logging';
import { createAllConnectors, type TrademarkRegisterConnector } from '@merkwacht/register-connectors';
import type { AiEnrichmentPort } from '@merkwacht/scoring';
import type { PipelineContext } from './pipelines/types.js';

/**
 * Builds every register connector currently supported via
 * `createAllConnectors` (BOIP/EUIPO/USPTO/WIPO deep + ~35 HTTP adapters).
 */
function createConnectors(_env: WorkerEnv): ReadonlyMap<string, TrademarkRegisterConnector> {
  return createAllConnectors();
}

/**
 * Builds the optional AI enrichment port from configured provider keys.
 * Missing / unsupported active provider ⇒ `undefined` (graceful degrade).
 */
export function createAiEnrichmentPort(env: WorkerEnv, jobStore: JobStore): AiEnrichmentPort | undefined {
  const resolved = resolveAiProvider({
    activeProvider: env.AI_ACTIVE_PROVIDER ?? 'openai',
    openaiKey: env.OPENAI_API_KEY,
    anthropicKey: env.ANTHROPIC_API_KEY,
    googleKey: env.GOOGLE_AI_API_KEY,
  });
  if (!resolved.enrichmentAvailable || !resolved.apiKey || resolved.provider !== 'openai') {
    return undefined;
  }
  return new OpenAiAssessmentProvider({
    apiKey: resolved.apiKey,
    getMonthlyUsageEur: (scope) => jobStore.getMonthlyUsageEur(scope),
    onUsageRecorded: (usage) => {
      jobStore.recordAiUsage({
        scope: usage.scope,
        provider: 'openai',
        estimatedCostEur: usage.estimatedCostEur,
      });
    },
  });
}

export interface CreatePipelineContextOptions {
  /** Inject an existing store (primarily for tests); defaults to a fresh, fixture-seeded `JobStore`. */
  readonly jobStore?: JobStore;
}

/** Constructs a fresh `PipelineContext`. Exposed separately from the process-wide singleton below so tests can build isolated contexts. */
export function createPipelineContext(env: WorkerEnv, options: CreatePipelineContextOptions = {}): PipelineContext {
  const jobStore = options.jobStore ?? createJobStore();
  const logger = createLogger({ service: 'worker', level: env.LOG_LEVEL });
  const connectors = createConnectors(env);
  const ai = createAiEnrichmentPort(env, jobStore);

  return { jobStore, logger, connectors, ...(ai ? { ai } : {}) };
}

let singleton: PipelineContext | null = null;

/**
 * Process-wide `PipelineContext`, built lazily on first access and reused
 * for the lifetime of the worker process - mirrors how `apps/api`'s
 * `AppStore` is constructed once in `app.ts`. Using an in-memory `JobStore`
 * here means state resets on restart, which is intentional for local dev
 * (see `job-store.ts`'s module doc).
 */
export function getPipelineContext(env: WorkerEnv): PipelineContext {
  if (!singleton) {
    singleton = createPipelineContext(env);
  }
  return singleton;
}

/** Resets the process-wide singleton. Only intended for test teardown. */
export function resetPipelineContext(): void {
  singleton = null;
}
