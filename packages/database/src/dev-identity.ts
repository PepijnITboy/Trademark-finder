/**
 * Hardcoded local development / tenancy-test identities.
 *
 * Seed IDs MUST stay in sync with `supabase/seed/seed.sql`.
 * DO NOT use `DevIdentityProvider` as production authority — request
 * tenant resolution (JWT → workspace_members) is the real path.
 */

export const DEV_SEED_IDS = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  workspaceId: '00000000-0000-4000-8000-000000000002',
  userId: '00000000-0000-4000-8000-000000000003',
  /** `public.platform_users.id`, distinct from `userId`. */
  platformUserRecordId: '00000000-0000-4000-8000-000000000004',
} as const;

/**
 * Second demo tenant (OrgBeta) for multi-org / tenancy isolation tests.
 * Stable UUIDs — also seeded in `supabase/seed/seed.sql`.
 */
export const DEMO_BETA_IDS = {
  organizationId: '00000000-0000-4000-8000-000000000011',
  workspaceId: '00000000-0000-4000-8000-000000000012',
  userId: '00000000-0000-4000-8000-000000000013',
} as const;

/** Alias kept for OrgStore / platform list compatibility. */
export const DEMO_SECONDARY_ORG_ID = DEMO_BETA_IDS.organizationId;

/**
 * `user_id`s that are also registered as an active `public.platform_users`
 * row locally. Platform routes must reject identities not in this list
 * (or not present in `platform_users` when using live Postgres).
 */
export const DEV_PLATFORM_USER_IDS: readonly string[] = [DEV_SEED_IDS.userId];

export function isDevPlatformUser(userId: string): boolean {
  return DEV_PLATFORM_USER_IDS.includes(userId);
}

export interface DevIdentity {
  organizationId: string;
  workspaceId: string;
  userId: string;
}

export interface TenantContext extends DevIdentity {
  readonly isPlatformOperator: boolean;
  readonly authMode: 'jwt' | 'demo';
  readonly role?: string;
}

export interface IdentityProvider {
  getIdentity(): DevIdentity;
  getTenant?(): TenantContext | undefined;
}

/**
 * Mutable request-scoped identity holder. Set by the API tenancy hook
 * via `enterWith` / explicit `setTenant` so concurrent requests do not
 * share a single org id.
 */
export class RequestScopedIdentityProvider implements IdentityProvider {
  private tenant: TenantContext | undefined;

  setTenant(tenant: TenantContext): void {
    this.tenant = tenant;
  }

  clearTenant(): void {
    this.tenant = undefined;
  }

  getTenant(): TenantContext | undefined {
    return this.tenant;
  }

  getIdentity(): DevIdentity {
    if (!this.tenant) {
      return { ...DEV_SEED_IDS };
    }
    return {
      organizationId: this.tenant.organizationId,
      workspaceId: this.tenant.workspaceId,
      userId: this.tenant.userId,
    };
  }
}

/** @deprecated Prefer RequestScopedIdentityProvider + resolveTenant. */
export class DevIdentityProvider implements IdentityProvider {
  getIdentity(): DevIdentity {
    return { ...DEV_SEED_IDS };
  }
}
