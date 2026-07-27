import { DEV_SEED_IDS } from '@merkwacht/database';
import type { WorkspaceRole } from '@merkwacht/domain';
import type { FastifyRequest } from 'fastify';

export interface DemoRequestContext {
  readonly actorUserId: string;
  readonly actorRole: WorkspaceRole;
  readonly actorDisplayName: string;
}

/**
 * Demo identity from request headers (no real auth yet):
 * - `x-demo-role`: `admin` | `jurist` (default `admin`)
 * - `x-demo-user-id`: optional user id override (defaults to dev seed user)
 */
export function resolveDemoRequestContext(request: FastifyRequest): DemoRequestContext {
  const roleHeader = request.headers['x-demo-role'];
  const roleValue = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
  const actorRole: WorkspaceRole = roleValue === 'jurist' ? 'jurist' : 'admin';

  const userHeader = request.headers['x-demo-user-id'];
  const userValue = Array.isArray(userHeader) ? userHeader[0] : userHeader;
  const actorUserId = userValue ?? DEV_SEED_IDS.userId;

  const displayName = actorRole === 'jurist' ? 'Demo Jurist' : 'Demo Admin';
  return { actorUserId, actorRole, actorDisplayName: displayName };
}

export function getOrganizationId(app: { identityProvider: { getIdentity(): { organizationId: string } } }): string {
  return app.identityProvider.getIdentity().organizationId;
}
