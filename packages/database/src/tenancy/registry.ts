/**
 * Tenancy table registry — drives the systematic isolation matrix.
 * workspace-scoped: customer members may access own org rows only.
 * register-wide: authenticated customers must be denied; service_role/platform only.
 */

export type TenancyActor = 'alpha_owner' | 'alpha_member' | 'beta_owner' | 'anon' | 'service_role' | 'platform';

export type TenancyOperation = 'select' | 'insert' | 'update' | 'delete' | 'list';

export type TableScope = 'workspace' | 'register' | 'platform';

export interface TenancyTableSpec {
  readonly name: string;
  readonly scope: TableScope;
  /** Expected outcome for actor × op — true = allowed, false = deny/empty. */
  readonly allow: Partial<Record<TenancyActor, Partial<Record<TenancyOperation, boolean>>>>;
}

export const TENANCY_TABLE_REGISTRY: readonly TenancyTableSpec[] = [
  {
    name: 'watched_trademarks',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, insert: true, update: true, delete: true, list: true },
      alpha_member: { select: true, insert: true, update: true, delete: false, list: true },
      beta_owner: { select: false, insert: false, update: false, delete: false, list: false },
      anon: { select: false, insert: false, update: false, delete: false, list: false },
      service_role: { select: true, insert: true, update: true, delete: true, list: true },
    },
  },
  {
    name: 'trademark_matches',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, update: true, list: true },
      alpha_member: { select: true, update: true, list: true },
      beta_owner: { select: false, update: false, list: false },
      anon: { select: false, update: false, list: false },
      service_role: { select: true, update: true, list: true },
    },
  },
  {
    name: 'match_notes',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, insert: true, list: true },
      beta_owner: { select: false, insert: false, list: false },
      anon: { select: false, insert: false, list: false },
      service_role: { select: true, insert: true, list: true },
    },
  },
  {
    name: 'notifications',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, list: true },
      beta_owner: { select: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
    },
  },
  {
    name: 'notification_recipients',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, insert: true, update: true, delete: true, list: true },
      beta_owner: { select: false, insert: false, update: false, delete: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
    },
  },
  {
    name: 'invoices',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, list: true },
      beta_owner: { select: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
      platform: { select: true, update: true, list: true },
    },
  },
  {
    name: 'support_threads',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, insert: true, list: true },
      beta_owner: { select: false, insert: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
      platform: { select: true, list: true },
    },
  },
  {
    name: 'support_messages',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, insert: true, list: true },
      beta_owner: { select: false, insert: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
    },
  },
  {
    name: 'exports',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, insert: true, list: true },
      beta_owner: { select: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
    },
  },
  {
    name: 'organization_settings',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, update: true },
      beta_owner: { select: false, update: false },
      anon: { select: false, update: false },
      service_role: { select: true, update: true },
    },
  },
  {
    name: 'workspace_subscriptions',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, list: true },
      beta_owner: { select: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
      platform: { select: true, update: true, list: true },
    },
  },
  {
    name: 'candidate_applications',
    scope: 'register',
    allow: {
      alpha_owner: { select: false, list: false },
      beta_owner: { select: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
      platform: { select: true, list: true },
    },
  },
  {
    name: 'processing_jobs',
    scope: 'register',
    allow: {
      alpha_owner: { select: false, list: false },
      beta_owner: { select: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
      platform: { select: true, list: true },
    },
  },
  {
    name: 'ai_usage_ledger',
    scope: 'register',
    allow: {
      alpha_owner: { select: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
      platform: { select: true, list: true },
    },
  },
  {
    name: 'platform_users',
    scope: 'platform',
    allow: {
      alpha_owner: { select: false, list: false },
      beta_owner: { select: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
      platform: { select: true, list: true },
    },
  },
  {
    name: 'organizations',
    scope: 'workspace',
    allow: {
      alpha_owner: { select: true, list: true },
      beta_owner: { select: false, list: false },
      anon: { select: false, list: false },
      service_role: { select: true, list: true },
      platform: { select: true, list: true },
    },
  },
];

export function expectedAccess(
  table: TenancyTableSpec,
  actor: TenancyActor,
  op: TenancyOperation,
): boolean | undefined {
  return table.allow[actor]?.[op];
}

/** Expand registry into concrete assertion cases. */
export function expandTenancyMatrix(): Array<{
  table: string;
  scope: TableScope;
  actor: TenancyActor;
  op: TenancyOperation;
  allowed: boolean;
}> {
  const cases: Array<{
    table: string;
    scope: TableScope;
    actor: TenancyActor;
    op: TenancyOperation;
    allowed: boolean;
  }> = [];

  for (const table of TENANCY_TABLE_REGISTRY) {
    for (const [actor, ops] of Object.entries(table.allow) as Array<
      [TenancyActor, Partial<Record<TenancyOperation, boolean>>]
    >) {
      for (const [op, allowed] of Object.entries(ops) as Array<[TenancyOperation, boolean]>) {
        cases.push({ table: table.name, scope: table.scope, actor, op, allowed });
      }
    }
  }
  return cases;
}
