import type { ApiEnv } from '@merkwacht/config';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

/**
 * A syntactically valid `ApiEnv`, pointing at unreachable Supabase
 * infrastructure. `createAppStore` probes Postgres reachability at startup
 * and falls back to the in-memory `DemoStore` when it's unreachable (see
 * `src/store/create-store.ts`), so `buildApp` still resolves and the routes
 * below can be exercised without a real Supabase/Postgres instance.
 */
const TEST_ENV: ApiEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  PORT: 4000,
  HOST: '0.0.0.0',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  INTERNAL_JOB_SECRET: 'a-test-internal-job-secret-value',
  CORS_ORIGIN: 'http://localhost:5173',
  BOIP_USE_FIXTURES: true,
};

describe('buildApp', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ env: TEST_ENV });
  }, 15_000);

  afterAll(async () => {
    await app.close();
  });

  it('responds 200 with an ok status on GET /api/v1/health', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({ status: 'ok', service: 'merkwacht-api' });
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it('responds 200 with the dashboard shape on GET /api/v1/dashboard', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/dashboard' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('kpis');
    expect(body).toHaveProperty('recentMatches');
    expect(body).toHaveProperty('upcomingDeadlines');
    expect(Array.isArray(body.recentMatches)).toBe(true);
    expect(Array.isArray(body.upcomingDeadlines)).toBe(true);
  });

  it('responds 404 with the standard error envelope for an unknown route', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'ROUTE_NOT_FOUND' });
  });
});
