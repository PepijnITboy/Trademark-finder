/**
 * Product roles for workspace members.
 * `owner` is the technical last-admin anchor; UI treats owner+admin as "Admin".
 * `jurist` is the default working role; `member` is kept for DB back-compat and maps to jurist in product rules.
 */
export const WORKSPACE_PRODUCT_ROLES = ['admin', 'jurist'] as const;
export type WorkspaceProductRole = (typeof WORKSPACE_PRODUCT_ROLES)[number];

export const WORKSPACE_ROLES = ['owner', 'admin', 'jurist', 'member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function toProductRole(role: WorkspaceRole): WorkspaceProductRole {
  if (role === 'jurist' || role === 'member') return 'jurist';
  return 'admin';
}

export function isAdminRole(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

export interface RoleChangeContext {
  readonly actorRole: WorkspaceRole;
  readonly targetRole: WorkspaceRole;
  readonly nextRole?: WorkspaceRole;
  readonly adminCount: number;
  readonly isSelf: boolean;
}

export type RoleGuardDenialReason =
  | 'actor_not_admin'
  | 'jurist_cannot_manage_admins'
  | 'cannot_remove_last_admin'
  | 'cannot_demote_last_admin'
  | 'cannot_change_owner';

/**
 * Server-side guard for member role changes and removals.
 * Returns null when allowed, otherwise a denial reason.
 */
export function assertRoleMutationAllowed(ctx: RoleChangeContext): RoleGuardDenialReason | null {
  if (!isAdminRole(ctx.actorRole)) {
    return 'actor_not_admin';
  }

  // Owners are protected anchors — only another owner could change them; we disallow entirely in v1.
  if (ctx.targetRole === 'owner' && (ctx.nextRole !== undefined || ctx.isSelf === false)) {
    if (ctx.nextRole !== undefined && ctx.nextRole !== 'owner') return 'cannot_change_owner';
    if (ctx.nextRole === undefined && !ctx.isSelf) return 'cannot_change_owner';
  }

  if (ctx.nextRole === undefined) {
    // Removal
    if (isAdminRole(ctx.targetRole) && ctx.adminCount <= 1) {
      return 'cannot_remove_last_admin';
    }
    return null;
  }

  // Role change
  const targetIsAdmin = isAdminRole(ctx.targetRole);
  const nextIsAdmin = isAdminRole(ctx.nextRole);

  if (targetIsAdmin && !nextIsAdmin && ctx.adminCount <= 1) {
    return 'cannot_demote_last_admin';
  }

  return null;
}

export const ROLE_GUARD_MESSAGES_NL: Record<RoleGuardDenialReason, string> = {
  actor_not_admin: 'Alleen een admin mag gebruikers en rollen beheren.',
  jurist_cannot_manage_admins: 'Een jurist mag geen admin wijzigen of verwijderen.',
  cannot_remove_last_admin: 'De laatste admin kan niet worden verwijderd.',
  cannot_demote_last_admin: 'De laatste admin kan niet worden gedegradeerd.',
  cannot_change_owner: 'De organisatie-eigenaar kan niet via deze actie worden gewijzigd.',
};
