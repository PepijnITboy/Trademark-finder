import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');
const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']).default('info');

/**
 * Full environment required by the API process. Includes server-only
 * secrets (service role key, internal job secret) - never share this
 * schema or its parsed output with browser/client code.
 */
export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INTERNAL_JOB_SECRET: z.string().min(16, 'INTERNAL_JOB_SECRET moet minimaal 16 tekens lang zijn.'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  OPENAI_API_KEY: z.string().optional(),
  BOIP_API_BASE_URL: z.string().url().optional(),
  BOIP_API_KEY: z.string().optional(),
  BOIP_USE_FIXTURES: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_IDS: z.string().optional(),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Full environment required by the background worker process. Also
 * server-only.
 */
export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INTERNAL_JOB_SECRET: z.string().min(16, 'INTERNAL_JOB_SECRET moet minimaal 16 tekens lang zijn.'),
  JOB_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  OPENAI_API_KEY: z.string().optional(),
  BOIP_API_BASE_URL: z.string().url().optional(),
  BOIP_API_KEY: z.string().optional(),
  BOIP_USE_FIXTURES: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

/**
 * Web-safe environment. `VITE_`-prefixed variables are inlined into the
 * client bundle by Vite, so this schema MUST NEVER contain a service-role
 * key, internal job secret, or any other server-only credential.
 */
export const webEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_API_BASE_URL: z.string().url().default('http://localhost:4000'),
});
export type WebEnv = z.infer<typeof webEnvSchema>;
