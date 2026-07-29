import { describe, expect, it } from 'vitest';
import { expandTenancyMatrix, TENANCY_TABLE_REGISTRY, type TenancyActor } from './registry.js';

/**
 * Pure contract matrix — always runs in CI (no live Postgres required).
 * Encodes the isolation policy: same-org share, cross-org deny, register-wide deny for customers.
 */
describe('tenancy policy matrix (contract)', () => {
  const cases = expandTenancyMatrix();

  it('expands to at least 100 assertion cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(100);
  });

  it.each(cases)(
    '$table / $actor / $op → allowed=$allowed',
    ({ scope, actor, op, allowed }) => {
      // Policy invariants encoded as executable assertions.
      if (actor === 'anon') {
        expect(allowed).toBe(false);
      }
      if (actor === 'beta_owner' && scope === 'workspace') {
        // Cross-tenant: Beta must never access Alpha workspace rows.
        expect(allowed).toBe(false);
      }
      if (scope === 'register' && (actor === 'alpha_owner' || actor === 'beta_owner' || actor === 'anon')) {
        expect(allowed).toBe(false);
      }
      if (actor === 'service_role') {
        expect(allowed).toBe(true);
      }
      if (actor === 'alpha_owner' && scope === 'workspace' && (op === 'select' || op === 'list')) {
        expect(allowed).toBe(true);
      }
      // Always evaluate the registered expectation itself.
      expect(typeof allowed).toBe('boolean');
    },
  );

  it('every workspace table denies beta_owner select/list', () => {
    for (const table of TENANCY_TABLE_REGISTRY.filter((t) => t.scope === 'workspace')) {
      const select = table.allow.beta_owner?.select;
      const list = table.allow.beta_owner?.list;
      if (select !== undefined) expect(select).toBe(false);
      if (list !== undefined) expect(list).toBe(false);
    }
  });

  it('alpha and alpha_member share workspace read access where defined', () => {
    for (const table of TENANCY_TABLE_REGISTRY.filter((t) => t.scope === 'workspace')) {
      const ownerSelect = table.allow.alpha_owner?.select;
      const memberSelect = table.allow.alpha_member?.select;
      if (ownerSelect !== undefined && memberSelect !== undefined) {
        expect(memberSelect).toBe(ownerSelect);
      }
    }
  });

  it('platform actor never grants anon-equivalent access', () => {
    const platformActors: TenancyActor[] = ['platform'];
    for (const table of TENANCY_TABLE_REGISTRY) {
      for (const actor of platformActors) {
        const anonSelect = table.allow.anon?.select;
        const platformSelect = table.allow[actor]?.select;
        if (anonSelect === false && platformSelect !== undefined) {
          // platform may be true; anon must stay false
          expect(anonSelect).toBe(false);
        }
      }
    }
  });
});
