import type { ApiEnv } from '@merkwacht/config';
import { createSupabaseAdminClient } from '@merkwacht/database';
import { isPlaceholderServiceRoleKey } from '../store/create-store.js';
import {
  createDemoMembershipDirectory,
  type MembershipLookup,
} from './resolve-tenant.js';

function looksLikeServiceRoleJwt(key: string): boolean {
  return key.startsWith('eyJ') && key.split('.').length >= 3;
}

/**
 * Builds the membership lookup used for tenant resolution.
 * Prefer live Supabase (service role) when configured; otherwise the
 * in-memory demo directory (OrgAlpha + OrgBeta).
 */
export function createMembershipLookup(env: ApiEnv): MembershipLookup {
  if (
    isPlaceholderServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY) ||
    !looksLikeServiceRoleJwt(env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    return createDemoMembershipDirectory();
  }

  const admin = createSupabaseAdminClient({
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const demoFallback = createDemoMembershipDirectory();

  return {
    async findMembershipByUserId(userId) {
      try {
        const { data, error } = await admin
          .from('workspace_members')
          .select('workspace_id, role, workspaces!inner(id, organization_id)')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (error || !data) {
          return demoFallback.findMembershipByUserId(userId);
        }

        const workspace = data.workspaces as unknown as { id: string; organization_id: string };
        return {
          organizationId: workspace.organization_id,
          workspaceId: data.workspace_id as string,
          role: data.role as string,
        };
      } catch {
        return demoFallback.findMembershipByUserId(userId);
      }
    },

    async isPlatformOperator(userId) {
      try {
        const { data, error } = await admin
          .from('platform_users')
          .select('id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (error) return demoFallback.isPlatformOperator(userId);
        return Boolean(data);
      } catch {
        return demoFallback.isPlatformOperator(userId);
      }
    },

    async resolveUserIdFromJwt(jwt) {
      try {
        const { data, error } = await admin.auth.getUser(jwt);
        if (error || !data.user) return null;
        return data.user.id;
      } catch {
        return null;
      }
    },
  };
}

export type { MembershipLookup };
