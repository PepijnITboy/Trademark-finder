import { OpenAiAssessmentProvider } from '@merkwacht/ai';
import type { WorkerEnv } from '@merkwacht/config';
import { createJobStore, JobStore } from '@merkwacht/database';
import { createLogger } from '@merkwacht/logging';
import { createBoipConnector, type TrademarkRegisterConnector } from '@merkwacht/register-connectors';
import type { AiEnrichmentPort } from '@merkwacht/scoring';
import type { PipelineContext } from './pipelines/types.js';

/**
 * Builds every register connector currently supported. Only BOIP exists
 * today (see `@merkwacht/register-connectors`'s `REGISTER_CODES`) - adding
 * a connector here is the only change needed for pipelines to pick it up,
 * since they're written against `PipelineContext.connectors`, never a
 * concrete connector type.
 */
function createConnectors(env: WorkerEnv): ReadonlyMap<string, TrademarkRegisterConnector> {
  const boip = createBoipConnector({
    apiBaseUrl: env.BOIP_API_BASE_URL,
    apiKey: env.BOIP_API_KEY,
    useFixtures: env.BOIP_USE_FIXTURES,
  });
  return new Map([[boip.registryCode, boip]]);
}

/**
 * Builds the optional AI enrichment port. `undefined` (not a disabled
 * stub) when `OPENAI_API_KEY` is unset, matching
 * `@merkwacht/scoring.scoreMatch`'s "fully functional without AI" contract
 * - see `docs/scoring/ai-layer.md`. Wires the provider's usage callback
 * onto `jobStore`'s AI usage ledger so `checkMonthlyBudget` sees real
 * spend on the next call.
 */
function createAiEnrichmentPort(env: WorkerEnv, jobStore: JobStore): AiEnrichmentPort | undefined {
  if (!env.OPENAI_API_KEY) {
    return undefined;
  }
  return new OpenAiAssessmentProvider({
    apiKey: env.OPENAI_API_KEY,
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
