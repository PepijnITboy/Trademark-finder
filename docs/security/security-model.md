# Security Model

This document describes authentication, authorization, and data-isolation
guarantees across Merkwacht.

## Identities and roles

Merkwacht has two distinct identity contexts:

1. **Customer users** — authenticated via Supabase Auth JWT (`Authorization: Bearer`).
   The API resolves `auth.uid()` → `workspace_members` → `organization_id` /
   `workspace_id`. Client-supplied organization ids are **never** authority.
   Workspace roles: `owner`, `admin`, `jurist` (product), mapped onto
   membership rows.
2. **Platform operators** — Merkwacht's internal team, identified by an active
   row in `public.platform_users` (see `private.is_platform_operator()`).
   Used exclusively to gate `/api/platform/*`. Not a role on customer
   `workspace_members`.

There is no shared "superuser" customer role that can see other
organizations' data through the normal application — cross-organization
visibility exists only through the service role (server-side) and platform
operator routes.

### Demo auth (non-production)

Demo headers (`x-demo-user-id`, `x-demo-role`) are accepted **only** when
`NODE_ENV=test` or `DEV_DEMO_AUTH=true`. They select a user; membership still
comes from the server directory. `x-demo-organization-id` is ignored.

## Row Level Security (RLS)

Every organization-/workspace-scoped table has RLS enabled with policies
keyed on `private.is_workspace_member` / `private.is_org_member` (security
definer, locked `search_path`). See
[`docs/database/schema.md`](../database/schema.md) and
[`docs/database/tenancy-audit.md`](../database/tenancy-audit.md).

Register-wide tables (`candidate_applications`, `processing_jobs`,
`ai_usage_ledger`, …) have RLS enabled with **no** policy granting the
`authenticated` role access — only service role / platform paths.

## Service role usage

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely and must:

- Never be sent to or embedded in `apps/web` client-side bundles.
- Only be read from environment variables on the server (`apps/api`,
  `apps/worker`).
- Be used with hand-written scoping (explicit `organization_id` /
  `workspace_id` filters) even though RLS isn't enforced for it.

Startup fail-fast: if credentials look configured but the DB probe fails,
the API throws unless `ALLOW_DEMO_STORE=true`. A placeholder service role
in development with a real Supabase URL produces a clear error telling you
to paste the dashboard `service_role` JWT.

## Internal job authentication

`apps/worker`'s HTTP-triggered endpoints require `INTERNAL_JOB_SECRET`.
This secret is never exposed to `apps/web`.

## `/app` vs `/platform` boundary

Both areas are served from `apps/web`, but:

- `/platform` API routes check `platform_users` / `isPlatformOperator` on
  every request (except `/health`).
- UI guards alone are insufficient.

## Isolation tests

See [`docs/testing/tenancy-matrix.md`](../testing/tenancy-matrix.md) and
`pnpm tenancy:test`. Same-org share / cross-org deny is covered by the
contract matrix, DemoStore scope tests, and API inject suites.
