import { describe, expect, it } from 'vitest';
import {
  assertRoleMutationAllowed,
  isAdminRole,
  toProductRole,
} from './roles.js';

describe('toProductRole', () => {
  it('maps owner/admin to admin and jurist/member to jurist', () => {
    expect(toProductRole('owner')).toBe('admin');
    expect(toProductRole('admin')).toBe('admin');
    expect(toProductRole('jurist')).toBe('jurist');
    expect(toProductRole('member')).toBe('jurist');
  });
});

describe('assertRoleMutationAllowed', () => {
  it('blocks non-admins from managing users', () => {
    expect(
      assertRoleMutationAllowed({
        actorRole: 'jurist',
        targetRole: 'jurist',
        nextRole: 'admin',
        adminCount: 2,
        isSelf: false,
      }),
    ).toBe('actor_not_admin');
  });

  it('blocks removing the last admin', () => {
    expect(
      assertRoleMutationAllowed({
        actorRole: 'admin',
        targetRole: 'admin',
        adminCount: 1,
        isSelf: true,
      }),
    ).toBe('cannot_remove_last_admin');
  });

  it('blocks demoting the last admin', () => {
    expect(
      assertRoleMutationAllowed({
        actorRole: 'admin',
        targetRole: 'admin',
        nextRole: 'jurist',
        adminCount: 1,
        isSelf: true,
      }),
    ).toBe('cannot_demote_last_admin');
  });

  it('allows demoting an admin when another remains', () => {
    expect(
      assertRoleMutationAllowed({
        actorRole: 'admin',
        targetRole: 'admin',
        nextRole: 'jurist',
        adminCount: 2,
        isSelf: false,
      }),
    ).toBeNull();
  });

  it('protects owner role changes', () => {
    expect(
      assertRoleMutationAllowed({
        actorRole: 'admin',
        targetRole: 'owner',
        nextRole: 'jurist',
        adminCount: 2,
        isSelf: false,
      }),
    ).toBe('cannot_change_owner');
  });

  it('isAdminRole treats owner as admin', () => {
    expect(isAdminRole('owner')).toBe(true);
    expect(isAdminRole('jurist')).toBe(false);
  });
});
