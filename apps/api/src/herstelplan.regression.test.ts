import type { ApiEnv } from '@merkwacht/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { FastifyInstance } from 'fastify';

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
  ALLOW_DEMO_STORE: true,
  DEV_DEMO_AUTH: true,
  BOIP_USE_FIXTURES: true,
  EUIPO_USE_FIXTURES: false,
  USPTO_USE_FIXTURES: false,
  WIPO_USE_FIXTURES: false,
};

describe('herstelplan protection + registers', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ env: TEST_ENV });
  }, 15_000);

  afterAll(async () => {
    await app.close();
  });

  it('watched trademarks include registerMonitoringOk; BOIP disabled ⇒ false', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/v1/watched-trademarks' });
    expect(before.statusCode).toBe(200);
    const watches = before.json().watchedTrademarks as Array<{
      registryCode: string;
      registerMonitoringOk: boolean;
      status: string;
    }>;
    const boip = watches.find((w) => w.registryCode === 'BOIP' && w.status === 'active');
    expect(boip?.registerMonitoringOk).toBe(true);

    const disable = await app.inject({
      method: 'PATCH',
      url: '/api/platform/register-catalog/BOIP',
      payload: {
        connectorStatus: 'disabled',
        enabledForWatch: false,
        disableReason: 'Test: connector offline voor bescherming',
      },
    });
    expect(disable.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: '/api/v1/watched-trademarks' });
    const watchesAfter = after.json().watchedTrademarks as Array<{
      registryCode: string;
      registerMonitoringOk: boolean;
    }>;
    expect(watchesAfter.every((w) => w.registryCode !== 'BOIP' || w.registerMonitoringOk === false)).toBe(
      true,
    );

    // Restore for later tests in this file
    await app.inject({
      method: 'PATCH',
      url: '/api/platform/register-catalog/BOIP',
      payload: { connectorStatus: 'live', enabledForWatch: true },
    });
    app.connectorCockpitStore.recordProbe('BOIP', 'ok', 'restored');
  });

  it('credentials upsert stores last4 and probe returns Dutch success copy', async () => {
    const upsert = await app.inject({
      method: 'POST',
      url: '/api/platform/register-catalog/EUIPO/credentials',
      payload: { apiKey: 'euipo-secret-key-4242' },
    });
    expect(upsert.statusCode).toBe(200);
    expect(upsert.json().runtime.apiKeyLast4).toBe('4242');
    expect(JSON.stringify(upsert.json())).not.toContain('euipo-secret-key');

    const live = await app.inject({
      method: 'PATCH',
      url: '/api/platform/register-catalog/EUIPO',
      payload: { connectorStatus: 'live' },
    });
    expect(live.statusCode).toBe(200);

    const probe = await app.inject({
      method: 'POST',
      url: '/api/platform/register-catalog/EUIPO/probe',
    });
    expect(probe.statusCode).toBe(200);
    expect(probe.json().success).toBe(true);
    expect(String(probe.json().messageNl).toLowerCase()).toContain('gelukt');

    const enable = await app.inject({
      method: 'PATCH',
      url: '/api/platform/register-catalog/EUIPO',
      payload: { enabledForWatch: true },
    });
    expect(enable.statusCode).toBe(200);
  });

  it('archive includes opposition_deadline_passed matches', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/archive' });
    expect(response.statusCode).toBe(200);
    const matches = response.json().matches as Array<{ status: string }>;
    expect(matches.some((m) => m.status === 'opposition_deadline_passed')).toBe(true);
  });

  it('deadlines include possible (new) matches with opposition window', async () => {
    const possible = await app.inject({ method: 'GET', url: '/api/v1/matches?queue=possible' });
    const possibleMatches = possible.json().matches as Array<{
      id: string;
      status: string;
      candidate: { oppositionDeadline: { deadlineDate: string } | null };
    }>;
    const withDeadline = possibleMatches.find(
      (m) => m.status === 'new' && m.candidate.oppositionDeadline !== null,
    );
    const deadlines = await app.inject({ method: 'GET', url: '/api/v1/deadlines' });
    expect(deadlines.statusCode).toBe(200);
    const ids = (deadlines.json().deadlines as Array<{ matchId: string }>).map((d) => d.matchId);
    if (withDeadline) {
      expect(ids).toContain(withDeadline.id);
    }
  });

  it('AI provider key upsert never echoes secret', async () => {
    const upsert = await app.inject({
      method: 'POST',
      url: '/api/platform/ai/providers/openai/key',
      payload: { apiKey: 'sk-test-openai-secret-9999' },
    });
    expect(upsert.statusCode).toBe(200);
    expect(upsert.json().runtime.last4).toBe('9999');
    expect(JSON.stringify(upsert.json())).not.toContain('sk-test-openai-secret');
  });
});
