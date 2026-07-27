import type { WorkerEnv } from '@merkwacht/config';
import { createLogger } from '@merkwacht/logging';
import { getPipelineContext } from './context.js';
import { JOB_HANDLERS, type JobType } from './handlers';
import type { PipelineContext } from './pipelines/types.js';

export interface PollerOptions {
  env: WorkerEnv;
}

export type StopPoller = () => void;

/**
 * Minimal polling loop stub. Replace with a real queue consumer (e.g. a
 * Supabase-backed `jobs` table or pg-boss) once that schema exists; the
 * `JOB_HANDLERS` dispatch table below is written so swapping the polling
 * transport won't require touching handler code.
 */
export function startPoller(options: PollerOptions): StopPoller {
  const logger = createLogger({ service: 'worker', level: options.env.LOG_LEVEL });
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = (): void => {
    if (stopped) {
      return;
    }
    logger.debug('Polling voor nieuwe taken (stub, nog geen wachtrij aangesloten).');
    timer = setTimeout(tick, options.env.JOB_POLL_INTERVAL_MS);
  };

  tick();
  logger.info('Worker gestart.', { pollIntervalMs: options.env.JOB_POLL_INTERVAL_MS });

  return () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
    }
  };
}

/**
 * Runs a single job by type against `context` (defaults to the process-wide
 * `PipelineContext` for `env`, built lazily by `apps/worker/src/context.ts`).
 * Tests and `/platform`'s on-demand trigger endpoint should pass an
 * explicit `context` to avoid depending on process-wide state.
 */
export async function runJob(
  jobType: JobType,
  payload: unknown,
  context: PipelineContext | { env: WorkerEnv },
): Promise<void> {
  const resolvedContext: PipelineContext = 'jobStore' in context ? context : getPipelineContext(context.env);
  const handler = JOB_HANDLERS[jobType];
  await handler(payload as never, resolvedContext);
}
