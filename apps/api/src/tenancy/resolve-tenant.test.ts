import { DEMO_BETA_IDS, DEV_SEED_IDS } from '@merkwacht/database';
import { AppError } from '@merkwacht/shared';
import { describe, expect, it } from 'vitest';
import {
  createDemoMembershipDirectory,
  isDemoAuthEnabled,
  resolveTenant,
} from './resolve-tenant.js';

function fakeRequest(headers: Record<string, string> = {}) {
  return { headers } as never;
}

describe('resolveTenant', () => {
  const membership = createDemoMembershipDirectory();

  it('resolves OrgAlpha from default demo user', async () => {
    const tenant = await resolveTenant(fakeRequest(), { NODE_ENV: 'test', DEV_DEMO_AUTH: undefined }, membership);
    expect(tenant.organizationId).toBe(DEV_SEED_IDS.organizationId);
    expect(tenant.workspaceId).toBe(DEV_SEED_IDS.workspaceId);
    expect(tenant.userId).toBe(DEV_SEED_IDS.userId);
    expect(tenant.isPlatformOperator).toBe(true);
    expect(tenant.authMode).toBe('demo');
  });

  it('resolves OrgBeta from beta demo user id (never trusts x-demo-organization-id)', async () => {
    const tenant = await resolveTenant(
      fakeRequest({
        'x-demo-user-id': DEMO_BETA_IDS.userId,
        'x-demo-organization-id': DEV_SEED_IDS.organizationId,
      }),
      { NODE_ENV: 'test', DEV_DEMO_AUTH: undefined },
      membership,
    );
    expect(tenant.organizationId).toBe(DEMO_BETA_IDS.organizationId);
    expect(tenant.userId).toBe(DEMO_BETA_IDS.userId);
    expect(tenant.isPlatformOperator).toBe(false);
  });

  it('rejects unknown demo user', async () => {
    await expect(
      resolveTenant(
        fakeRequest({ 'x-demo-user-id': '00000000-0000-4000-8000-000000000099' }),
        { NODE_ENV: 'test', DEV_DEMO_AUTH: undefined },
        membership,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects when demo auth disabled and no JWT', async () => {
    await expect(
      resolveTenant(fakeRequest(), { NODE_ENV: 'production', DEV_DEMO_AUTH: undefined }, membership),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('allows demo auth when DEV_DEMO_AUTH=true outside test', async () => {
    expect(isDemoAuthEnabled({ NODE_ENV: 'development', DEV_DEMO_AUTH: true })).toBe(true);
    const tenant = await resolveTenant(
      fakeRequest(),
      { NODE_ENV: 'development', DEV_DEMO_AUTH: true },
      membership,
    );
    expect(tenant.organizationId).toBe(DEV_SEED_IDS.organizationId);
  });

  it('resolves JWT user via membership.resolveUserIdFromJwt', async () => {
    const jwtMembership = {
      ...membership,
      async resolveUserIdFromJwt(jwt: string) {
        return jwt === 'beta-token' ? DEMO_BETA_IDS.userId : null;
      },
    };
    const tenant = await resolveTenant(
      fakeRequest({ authorization: 'Bearer beta-token' }),
      { NODE_ENV: 'production', DEV_DEMO_AUTH: undefined },
      jwtMembership,
    );
    expect(tenant.organizationId).toBe(DEMO_BETA_IDS.organizationId);
    expect(tenant.authMode).toBe('jwt');
  });

  it('rejects invalid JWT', async () => {
    const jwtMembership = {
      ...membership,
      async resolveUserIdFromJwt() {
        return null;
      },
    };
    await expect(
      resolveTenant(
        fakeRequest({ authorization: 'Bearer bad' }),
        { NODE_ENV: 'production', DEV_DEMO_AUTH: undefined },
        jwtMembership,
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
