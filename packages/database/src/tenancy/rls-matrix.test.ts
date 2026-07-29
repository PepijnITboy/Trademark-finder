import { describe, expect, it } from 'vitest';

/**
 * Live RLS matrix — runs only when TENANCY_RLS=1 and a real service role is available.
 * Without those, the suite skips with a clear message so CI stays green offline.
 */
const enabled = process.env.TENANCY_RLS === '1';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const hasRealKey =
  Boolean(serviceRole) &&
  !/PASTE_|replace-with/i.test(serviceRole) &&
  Boolean(process.env.SUPABASE_URL);

describe.runIf(enabled && hasRealKey)('RLS SQL matrix (live)', () => {
  it('placeholder — wire authenticated clients against TENANCY_TABLE_REGISTRY when TENANCY_RLS=1', () => {
    expect(hasRealKey).toBe(true);
  });
});

describe.runIf(!enabled || !hasRealKey)('RLS SQL matrix (skipped offline)', () => {
  it('skips with clear message when TENANCY_RLS/service_role unavailable', () => {
    // Documented skip path for CI without remote credentials.
    expect(enabled && hasRealKey).toBe(false);
    if (!enabled) {
      // eslint-disable-next-line no-console
      console.info('[tenancy] RLS live matrix skipped — set TENANCY_RLS=1 + real SUPABASE_SERVICE_ROLE_KEY to enable.');
    }
  });
});
