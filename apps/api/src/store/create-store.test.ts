import type { ApiEnv } from '@merkwacht/config';
import { describe, expect, it, vi } from 'vitest';
import {
  createAppStore,
  isDemoStoreAllowed,
  isPlaceholderServiceRoleKey,
  looksLikeConfiguredSupabaseUrl,
} from './create-store.js';
import type { AppStore } from './types.js';

function baseEnv(overrides: Partial<ApiEnv> = {}): ApiEnv {
  return {
    NODE_ENV: 'development',
    LOG_LEVEL: 'error',
    PORT: 4000,
    HOST: '0.0.0.0',
    SUPABASE_URL: 'https://bozjfellwdntglhtyzst.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
    INTERNAL_JOB_SECRET: 'a-test-internal-job-secret-value',
    CORS_ORIGIN: 'http://localhost:5173',
    ALLOW_DEMO_STORE: undefined,
    DEV_DEMO_AUTH: undefined,
    ...overrides,
  };
}

function silentLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  } as never;
}

function fakeStore(kind: 'demo' | 'postgres'): AppStore {
  return {
    kind,
    ping: async () => undefined,
  } as unknown as AppStore;
}

describe('create-store helpers', () => {
  it('detects placeholder service role keys', () => {
    expect(isPlaceholderServiceRoleKey('PASTE_SERVICE_ROLE_JWT_FROM_DASHBOARD')).toBe(true);
    expect(isPlaceholderServiceRoleKey('replace-with-local-service-role-key')).toBe(true);
    expect(isPlaceholderServiceRoleKey('')).toBe(true);
    expect(isPlaceholderServiceRoleKey(null)).toBe(true);
    expect(isPlaceholderServiceRoleKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real')).toBe(false);
  });

  it('treats http(s) URLs as configured Supabase targets', () => {
    expect(looksLikeConfiguredSupabaseUrl('https://bozjfellwdntglhtyzst.supabase.co')).toBe(true);
    expect(looksLikeConfiguredSupabaseUrl('http://127.0.0.1:54321')).toBe(true);
  });

  it('allows DemoStore in test or with ALLOW_DEMO_STORE', () => {
    expect(isDemoStoreAllowed({ NODE_ENV: 'test', ALLOW_DEMO_STORE: undefined })).toBe(true);
    expect(isDemoStoreAllowed({ NODE_ENV: 'development', ALLOW_DEMO_STORE: true })).toBe(true);
    expect(isDemoStoreAllowed({ NODE_ENV: 'development', ALLOW_DEMO_STORE: undefined })).toBe(false);
    expect(isDemoStoreAllowed({ NODE_ENV: 'production', ALLOW_DEMO_STORE: undefined })).toBe(false);
  });
});

describe('createAppStore', () => {
  it('returns PostgresStore when probe succeeds', async () => {
    const postgres = fakeStore('postgres');
    const store = await createAppStore(baseEnv(), silentLogger(), {
      probe: async () => undefined,
      createPostgres: () => postgres as AppStore & { ping(): Promise<void> },
    });
    expect(store.kind).toBe('postgres');
  });

  it('throws when credentials look real and probe fails without ALLOW_DEMO_STORE', async () => {
    await expect(
      createAppStore(baseEnv({ ALLOW_DEMO_STORE: undefined }), silentLogger(), {
        probe: async () => {
          throw new Error('connection refused');
        },
        createPostgres: () => fakeStore('postgres') as AppStore & { ping(): Promise<void> },
      }),
    ).rejects.toThrow(/niet bereikbaar|ALLOW_DEMO_STORE/i);
  });

  it('falls back to DemoStore when probe fails and ALLOW_DEMO_STORE=true', async () => {
    const demo = fakeStore('demo');
    const store = await createAppStore(baseEnv({ ALLOW_DEMO_STORE: true }), silentLogger(), {
      probe: async () => {
        throw new Error('connection refused');
      },
      createPostgres: () => fakeStore('postgres') as AppStore & { ping(): Promise<void> },
      createDemo: () => demo,
    });
    expect(store).toBe(demo);
  });

  it('throws a clear error in development when service role is still a placeholder', async () => {
    await expect(
      createAppStore(
        baseEnv({
          SUPABASE_SERVICE_ROLE_KEY: 'PASTE_SERVICE_ROLE_JWT_FROM_DASHBOARD',
          ALLOW_DEMO_STORE: undefined,
        }),
        silentLogger(),
      ),
    ).rejects.toThrow(/service_role|PASTE_|Dashboard/i);
  });

  it('uses DemoStore for placeholder key when NODE_ENV=test', async () => {
    const demo = fakeStore('demo');
    const store = await createAppStore(
      baseEnv({
        NODE_ENV: 'test',
        SUPABASE_SERVICE_ROLE_KEY: 'PASTE_SERVICE_ROLE_JWT_FROM_DASHBOARD',
      }),
      silentLogger(),
      { createDemo: () => demo },
    );
    expect(store).toBe(demo);
  });

  it('uses DemoStore for placeholder key when ALLOW_DEMO_STORE=true', async () => {
    const demo = fakeStore('demo');
    const store = await createAppStore(
      baseEnv({
        SUPABASE_SERVICE_ROLE_KEY: 'replace-with-local-service-role-key',
        ALLOW_DEMO_STORE: true,
      }),
      silentLogger(),
      { createDemo: () => demo },
    );
    expect(store).toBe(demo);
  });
});
