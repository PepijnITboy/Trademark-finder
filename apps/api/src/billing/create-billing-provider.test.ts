import type { ApiEnv } from '@merkwacht/config';
import { describe, expect, it } from 'vitest';
import { createBillingProvider } from './create-billing-provider.js';
import { MockStripeBillingProvider } from './mock-provider.js';
import { UnconfiguredBillingProvider } from './mock-provider.js';

const BASE_ENV = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'error',
  PORT: 4000,
  HOST: '0.0.0.0',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  INTERNAL_JOB_SECRET: 'a-test-internal-job-secret-value',
  CORS_ORIGIN: 'http://localhost:5173',
  ALLOW_DEMO_STORE: false,
  DEV_DEMO_AUTH: false,
  BOIP_USE_FIXTURES: true,
  EUIPO_USE_FIXTURES: false,
  USPTO_USE_FIXTURES: false,
  WIPO_USE_FIXTURES: false,
} satisfies ApiEnv;

describe('createBillingProvider', () => {
  it('uses the mock provider in test env without a stripe key', () => {
    const provider = createBillingProvider({ ...BASE_ENV, NODE_ENV: 'test' });
    expect(provider).toBeInstanceOf(MockStripeBillingProvider);
    expect(provider.configured).toBe(true);
  });

  it('returns an unconfigured provider in development without a stripe key', () => {
    const provider = createBillingProvider(BASE_ENV);
    expect(provider).toBeInstanceOf(UnconfiguredBillingProvider);
    expect(provider.configured).toBe(false);
  });
});
