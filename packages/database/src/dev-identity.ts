/**
 * Hardcoded local development identity.
 *
 * Used to run and seed the app before real authentication and
 * multi-tenant session resolution are wired up. These UUIDs are seed IDs
 * and MUST stay in sync with the fixtures inserted by `supabase/seed`.
 *
 * DO NOT use `DevIdentityProvider` in production code paths - it exists
 * purely to unblock local development and tests.
 */
export const DEV_SEED_IDS = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  workspaceId: '00000000-0000-4000-8000-000000000002',
  userId: '00000000-0000-4000-8000-000000000003',
  /** `public.platform_users.id`, distinct from `userId` (`public.platform_users.user_id`) - see `supabase/seed/seed.sql`. */
  platformUserRecordId: '00000000-0000-4000-8000-000000000004',
} as const;

/**
 * `user_id`s that are also registered as an active `public.platform_users`
 * row locally (see `supabase/seed/seed.sql`'s comment: "The dev user
 * doubles as a platform operator locally"). `apps/api`'s `/api/platform/*`
 * routes must reject any `DevIdentity` whose `userId` isn't in this list -
 * never assume every dev identity is a platform operator.
 */
export const DEV_PLATFORM_USER_IDS: readonly string[] = [DEV_SEED_IDS.userId];

/** Whether `userId` is a known platform operator locally. Mirrors the `public.platform_users` membership check a real deployment would run against Postgres. */
export function isDevPlatformUser(userId: string): boolean {
  return DEV_PLATFORM_USER_IDS.includes(userId);
}

export interface DevIdentity {
  organizationId: string;
  workspaceId: string;
  userId: string;
}

export interface IdentityProvider {
  getIdentity(): DevIdentity;
}

export class DevIdentityProvider implements IdentityProvider {
  getIdentity(): DevIdentity {
    return { ...DEV_SEED_IDS };
  }
}
