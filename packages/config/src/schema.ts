import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');
const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']).default('info');

/**
 * Full environment required by the API process. Includes server-only
 * secrets (service role key, internal job secret) - never share this
 * schema or its parsed output with browser/client code.
 */
const booleanFlagSchema = z
  .string()
  .optional()
  .transform((value) => value === 'true');

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
  /**
   * When true, allow in-memory DemoStore even if Supabase is misconfigured
   * or unreachable. Prefer fixing SUPABASE_SERVICE_ROLE_KEY in development.
   */
  ALLOW_DEMO_STORE: booleanFlagSchema,
  /**
   * When true (or NODE_ENV=test), allow demo auth headers instead of a real
   * Supabase JWT. Never enable in production.
   */
  DEV_DEMO_AUTH: booleanFlagSchema,
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  AI_ACTIVE_PROVIDER: z.enum(['openai', 'anthropic', 'google', 'none']).optional(),
  BOIP_API_BASE_URL: z.string().url().optional(),
  BOIP_API_KEY: z.string().optional(),
  BOIP_USE_FIXTURES: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  EUIPO_CLIENT_ID: z.string().optional(),
  EUIPO_CLIENT_SECRET: z.string().optional(),
  EUIPO_API_BASE_URL: z.string().url().optional(),
  EUIPO_TOKEN_URL: z.string().url().optional(),
  EUIPO_OPEN_DATA_BASE_URL: z.string().url().optional(),
  EUIPO_USE_FIXTURES: booleanFlagSchema,
  USPTO_API_KEY: z.string().optional(),
  USPTO_API_BASE_URL: z.string().url().optional(),
  USPTO_GAZETTE_FEED_URL: z.string().url().optional(),
  USPTO_USE_FIXTURES: booleanFlagSchema,
  WIPO_FTP_HOST: z.string().optional(),
  WIPO_FTP_USER: z.string().optional(),
  WIPO_FTP_PASSWORD: z.string().optional(),
  WIPO_FTP_REMOTE_DIR: z.string().optional(),
  WIPO_USE_FIXTURES: booleanFlagSchema,
  /**
   * Every other register in `@merkwacht/domain`'s `DEFAULT_REGISTER_CATALOG`
   * (e.g. `UKIPO`, `DPMA`, `CIPO`, `IPAU`, `CNIPA`, ...) is wired through
   * `@merkwacht/register-connectors`' generic HTTP factory
   * (`createConfiguredHttpConnector`) and reads its own
   * `{CODE}_API_BASE_URL` / `{CODE}_API_KEY` / `{CODE}_USE_FIXTURES`
   * environment variables directly via `process.env` rather than being
   * individually declared here - there are ~35 of them and adding a
   * register to the catalog should not require a schema change here too.
   * See `docs/connectors/connector-contract.md` and
   * `packages/register-connectors/src/catalog/create-all-connectors.ts`.
   */
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
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  AI_ACTIVE_PROVIDER: z.enum(['openai', 'anthropic', 'google', 'none']).optional(),
  BOIP_API_BASE_URL: z.string().url().optional(),
  BOIP_API_KEY: z.string().optional(),
  BOIP_USE_FIXTURES: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  EUIPO_CLIENT_ID: z.string().optional(),
  EUIPO_CLIENT_SECRET: z.string().optional(),
  EUIPO_API_BASE_URL: z.string().url().optional(),
  EUIPO_TOKEN_URL: z.string().url().optional(),
  EUIPO_OPEN_DATA_BASE_URL: z.string().url().optional(),
  EUIPO_USE_FIXTURES: booleanFlagSchema,
  USPTO_API_KEY: z.string().optional(),
  USPTO_API_BASE_URL: z.string().url().optional(),
  USPTO_GAZETTE_FEED_URL: z.string().url().optional(),
  USPTO_USE_FIXTURES: booleanFlagSchema,
  WIPO_FTP_HOST: z.string().optional(),
  WIPO_FTP_USER: z.string().optional(),
  WIPO_FTP_PASSWORD: z.string().optional(),
  WIPO_FTP_REMOTE_DIR: z.string().optional(),
  WIPO_USE_FIXTURES: booleanFlagSchema,
  // See `apiEnvSchema`'s equivalent comment above: every other register
  // reads its own `{CODE}_*` env vars directly, not declared here.
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
