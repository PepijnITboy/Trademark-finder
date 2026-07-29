import { describe, expect, it, vi } from 'vitest';
import { runStartupSelfCheck } from './startup-self-check.js';
import type { AppStore } from '../store/types.js';

function silentLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() } as never;
}

describe('runStartupSelfCheck', () => {
  it('passes for DemoStore when ALLOW_DEMO_STORE is set', async () => {
    const store = { kind: 'demo' } as AppStore;
    const result = await runStartupSelfCheck(store, { NODE_ENV: 'development', ALLOW_DEMO_STORE: true }, silentLogger());
    expect(result.ok).toBe(true);
    expect(result.storeKind).toBe('demo');
  });

  it('fails DemoStore when demo is not allowed', async () => {
    const store = { kind: 'demo' } as AppStore;
    const result = await runStartupSelfCheck(
      store,
      { NODE_ENV: 'production', ALLOW_DEMO_STORE: undefined },
      silentLogger(),
    );
    expect(result.ok).toBe(false);
  });

  it('pings postgres store', async () => {
    const store = {
      kind: 'postgres',
      ping: vi.fn().mockResolvedValue(undefined),
    } as unknown as AppStore;
    const result = await runStartupSelfCheck(store, { NODE_ENV: 'production', ALLOW_DEMO_STORE: undefined }, silentLogger());
    expect(result.ok).toBe(true);
    expect((store as { ping: ReturnType<typeof vi.fn> }).ping).toHaveBeenCalled();
  });
});
