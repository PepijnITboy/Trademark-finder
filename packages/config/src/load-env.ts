import { AppError } from '@merkwacht/shared';
import type { ZodError, ZodType, ZodTypeDef } from 'zod';
import { apiEnvSchema, webEnvSchema, workerEnvSchema, type ApiEnv, type WebEnv, type WorkerEnv } from './schema';

export type EnvTarget = 'api' | 'worker' | 'web';
export type EnvSource = Record<string, string | undefined>;

/** Keys that must never be reachable from a client/browser environment. */
const SERVER_ONLY_KEYS = ['SUPABASE_SERVICE_ROLE_KEY', 'INTERNAL_JOB_SECRET'] as const;

function formatZodError(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

function parseWithSchema<T>(schema: ZodType<T, ZodTypeDef, unknown>, source: EnvSource, target: EnvTarget): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new AppError({
      code: 'CONFIG_INVALID_ENV',
      messageNl: `Ongeldige of ontbrekende omgevingsvariabelen voor ${target}.`,
      category: 'CONFIGURATION',
      details: { target, issues: formatZodError(result.error) },
    });
  }
  return result.data;
}

/**
 * Defensive guard: throws if a server-only secret is ever present on an
 * object destined for client/browser code. `webEnvSchema` already excludes
 * these keys by construction, but this guard protects against future
 * schema edits accidentally widening the web-safe surface.
 */
function assertNoServerSecrets<T extends Record<string, unknown>>(env: T): T {
  for (const key of SERVER_ONLY_KEYS) {
    if (key in env) {
      throw new AppError({
        code: 'CONFIG_SECRET_LEAK',
        messageNl: 'Er is per ongeluk een servergeheim naar de client-configuratie gelekt.',
        category: 'CONFIGURATION',
      });
    }
  }
  return env;
}

export function loadEnv(target: 'api', source?: EnvSource): ApiEnv;
export function loadEnv(target: 'worker', source?: EnvSource): WorkerEnv;
export function loadEnv(target: 'web', source?: EnvSource): WebEnv;
export function loadEnv(target: EnvTarget, source: EnvSource = process.env): ApiEnv | WorkerEnv | WebEnv {
  switch (target) {
    case 'api':
      return parseWithSchema(apiEnvSchema, source, target);
    case 'worker':
      return parseWithSchema(workerEnvSchema, source, target);
    case 'web':
      return assertNoServerSecrets(parseWithSchema(webEnvSchema, source, target));
    default: {
      const exhaustiveCheck: never = target;
      throw new AppError({
        code: 'CONFIG_UNKNOWN_TARGET',
        messageNl: `Onbekend configuratiedoel: ${String(exhaustiveCheck)}`,
        category: 'CONFIGURATION',
      });
    }
  }
}
