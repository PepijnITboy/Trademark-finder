import { AsyncLocalStorage } from 'node:async_hooks';
import type { ApiEnv } from '@merkwacht/config';
import {
  DEMO_BETA_IDS,
  DEV_SEED_IDS,
  isDevPlatformUser,
  type TenantContext,
} from '@merkwacht/database';
import type { WorkspaceRole } from '@merkwacht/domain';
import { AppError } from '@merkwacht/shared';
import type { FastifyRequest } from 'fastify';

export const tenantAls = new AsyncLocalStorage<TenantContext>();

export interface DemoRequestContext {
  readonly actorUserId: string;
  readonly actorRole: WorkspaceRole;
  readonly actorDisplayName: string;
}

export interface MembershipLookup {
  findMembershipByUserId(userId: string): Promise<{
    organizationId: string;
    workspaceId: string;
    role: string;
  } | null>;
  isPlatformOperator(userId: string): Promise<boolean>;
  resolveUserIdFromJwt?(jwt: string): Promise<string | null>;
}

/** In-memory membership directory for DemoStore / CI tenancy tests. */
export function createDemoMembershipDirectory(): MembershipLookup {
  const members = new Map<
    string,
    { organizationId: string; workspaceId: string; role: string }
  >([
    [
      DEV_SEED_IDS.userId,
      {
        organizationId: DEV_SEED_IDS.organizationId,
        workspaceId: DEV_SEED_IDS.workspaceId,
        role: 'owner',
      },
    ],
    [
      DEMO_BETA_IDS.userId,
      {
        organizationId: DEMO_BETA_IDS.organizationId,
        workspaceId: DEMO_BETA_IDS.workspaceId,
        role: 'owner',
      },
    ],
  ]);

  return {
    async findMembershipByUserId(userId) {
      return members.get(userId) ?? null;
    },
    async isPlatformOperator(userId) {
      return isDevPlatformUser(userId);
    },
  };
}

export function isDemoAuthEnabled(env: Pick<ApiEnv, 'NODE_ENV' | 'DEV_DEMO_AUTH'>): boolean {
  return env.NODE_ENV === 'test' || env.DEV_DEMO_AUTH === true;
}

function headerValue(request: FastifyRequest, name: string): string | undefined {
  const raw = request.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

function extractBearerToken(request: FastifyRequest): string | undefined {
  const authorization = headerValue(request, 'authorization');
  if (!authorization) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || undefined;
}

/**
 * Demo identity from request headers — ONLY when demo auth is enabled:
 * - `x-demo-role`: `admin` | `jurist` (default `admin`)
 * - `x-demo-user-id`: optional user id (defaults to OrgAlpha owner)
 * - `x-demo-organization-id`: IGNORED as authority
 */
export function resolveDemoRequestContext(request: FastifyRequest): DemoRequestContext {
  const roleValue = headerValue(request, 'x-demo-role');
  const actorRole: WorkspaceRole = roleValue === 'jurist' ? 'jurist' : 'admin';
  const actorUserId = headerValue(request, 'x-demo-user-id') ?? DEV_SEED_IDS.userId;
  const displayName = actorRole === 'jurist' ? 'Demo Jurist' : 'Demo Admin';
  return { actorUserId, actorRole, actorDisplayName: displayName };
}

/**
 * Resolves the request tenant. Client-supplied organizationId is NEVER authority.
 */
export async function resolveTenant(
  request: FastifyRequest,
  env: Pick<ApiEnv, 'NODE_ENV' | 'DEV_DEMO_AUTH'>,
  membership: MembershipLookup,
): Promise<TenantContext> {
  const bearer = extractBearerToken(request);

  if (bearer && membership.resolveUserIdFromJwt) {
    const userId = await membership.resolveUserIdFromJwt(bearer);
    if (!userId) {
      throw new AppError({
        code: 'UNAUTHENTICATED',
        messageNl: 'Ongeldige of verlopen sessie.',
        category: 'AUTHENTICATION',
      });
    }
    const member = await membership.findMembershipByUserId(userId);
    if (!member) {
      throw new AppError({
        code: 'TENANT_NOT_FOUND',
        messageNl: 'Geen organisatie gevonden voor deze gebruiker.',
        category: 'AUTHORIZATION',
      });
    }
    const isPlatformOperator = await membership.isPlatformOperator(userId);
    return {
      userId,
      organizationId: member.organizationId,
      workspaceId: member.workspaceId,
      role: member.role,
      isPlatformOperator,
      authMode: 'jwt',
    };
  }

  if (isDemoAuthEnabled(env)) {
    const demo = resolveDemoRequestContext(request);
    void headerValue(request, 'x-demo-organization-id');

    const member = await membership.findMembershipByUserId(demo.actorUserId);
    if (!member) {
      throw new AppError({
        code: 'TENANT_NOT_FOUND',
        messageNl: 'Onbekende demo-gebruiker; geen tenant-lidmaatschap.',
        category: 'AUTHORIZATION',
      });
    }
    const isPlatformOperator = await membership.isPlatformOperator(demo.actorUserId);
    return {
      userId: demo.actorUserId,
      organizationId: member.organizationId,
      workspaceId: member.workspaceId,
      role: member.role,
      isPlatformOperator,
      authMode: 'demo',
    };
  }

  if (bearer) {
    throw new AppError({
      code: 'UNAUTHENTICATED',
      messageNl: 'JWT-validatie is niet beschikbaar (service role ontbreekt of Auth niet geconfigureerd).',
      category: 'AUTHENTICATION',
    });
  }

  throw new AppError({
    code: 'UNAUTHENTICATED',
    messageNl: 'Authenticatie vereist (Bearer JWT). Demo-headers zijn uitgeschakeld.',
    category: 'AUTHENTICATION',
  });
}

export function getTenantFromRequest(request: FastifyRequest): TenantContext {
  if (request.tenant) return request.tenant;
  const fromAls = tenantAls.getStore();
  if (fromAls) return fromAls;
  throw new AppError({
    code: 'UNAUTHENTICATED',
    messageNl: 'Geen tenant-context op dit verzoek.',
    category: 'AUTHENTICATION',
  });
}

/** Organization id from request-scoped tenant — never from client body/params. */
export function getOrganizationId(request: FastifyRequest): string {
  return getTenantFromRequest(request).organizationId;
}

export function getUserId(request: FastifyRequest): string {
  return getTenantFromRequest(request).userId;
}

export function assertPlatformOperator(tenant: TenantContext): void {
  if (!tenant.isPlatformOperator) {
    throw new AppError({
      code: 'PLATFORM_ACCESS_DENIED',
      messageNl: 'Deze gebruiker heeft geen toegang tot het platformbeheer.',
      category: 'AUTHORIZATION',
    });
  }
}
