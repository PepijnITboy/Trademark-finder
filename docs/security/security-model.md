# Security Model

This document describes authentication, authorization, and data-isolation
guarantees across Merkwacht.

## Identities and roles

Merkwacht has two distinct identity contexts:

1. **Customer users** — authenticated via Supabase Auth, linked to one or
   more `organization` rows through `member`. Roles within an organization:
   `owner`, `admin`, `member`.
2. **Platform operators** — Merkwacht's internal team, identified by the
   `platform_operator` role on their `member` row (not tied to a specific
   customer organization's data). Used exclusively to gate access to
   `/platform`.

There is no shared "superuser" customer role that can see other
organizations' data through the normal application — cross-organization
visibility exists only through the service role, used solely by
`apps/worker` and specific `apps/api` internal routes.

## Row Level Security (RLS)

Every organization-scoped table (see
[`docs/database/schema.md`](../database/schema.md)) has RLS enabled with
policies of the shape:

```sql
create policy "org_members_can_select"
  on watched_trademark
  for select
  using (
    organization_id in (
      select organization_id from member where user_id = auth.uid()
    )
  );
```

Equivalent `insert`/`update`/`delete` policies additionally check role level
where relevant (e.g. only `owner`/`admin` may delete a `watched_trademark`,
any `member` may view it).

Register-wide, non-organization-scoped tables (`candidate_application`,
`opposition_deadline`, `source_checkpoint`, `processing_job`,
`ai_usage_ledger`) have RLS enabled with **no** policy granting the
`authenticated` role access at all — they are only readable via:

- The Supabase **service role** (used server-side only, in `apps/api` and
  `apps/worker`, never shipped to the browser).
- A dedicated `platform_operator` policy for read access from `/platform`.

## Service role usage

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely and must:

- Never be sent to or embedded in `apps/web` client-side bundles.
- Only be read from environment variables on the server (`apps/api`,
  `apps/worker`).
- Be used with hand-written scoping (explicit `organization_id` filters in
  queries) even though RLS isn't enforced for it, so a bug in the service
  role code path doesn't leak cross-organization data.

## Internal job authentication

`apps/worker`'s HTTP-triggered endpoints (used for scheduled/cron
invocation and manual on-demand runs from `/platform`, see
[`docs/operations/daily-jobs.md`](../operations/daily-jobs.md)) require the
`INTERNAL_JOB_SECRET` as a bearer token or signed header. This secret:

- Is never exposed to `apps/web`.
- Should be rotated if ever suspected leaked (e.g. accidentally logged).
- Is validated with a constant-time comparison to avoid timing attacks.

## `/app` vs `/platform` boundary

Both areas are served from `apps/web`, but:

- `/platform` routes check for `platform_operator` membership server-side
  (in a layout/middleware guard) before rendering, and independently, all
  data fetched for `/platform` goes through API routes that check the same
  role — the UI guard alone is not treated as sufficient authorization.
- `/app` routes never expose register-wide data
  (`candidate_application`/`opposition_deadline` raw rows) directly — they
  only expose the customer's own `trademark_match` rows, which already join
  in the minimum necessary candidate fields needed for display.

## Secrets inventory

| Secret | Used by | Exposure |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/api`, `apps/worker` | Server-only |
| `SUPABASE_ANON_KEY` | `apps/web` | Public (RLS-protected) |
| `OPENAI_API_KEY` | `packages/ai` (via `apps/worker`) | Server-only |
| `BOIP_API_KEY` | `packages/register-connectors` (via `apps/worker`) | Server-only |
| `INTERNAL_JOB_SECRET` | `apps/worker` endpoints, scheduler | Server-only |

None of the server-only secrets above should ever appear in a
`NEXT_PUBLIC_`-prefixed environment variable or in any bundle shipped to the
browser. CI should include a check (e.g. a grep-based guard or bundle
analysis step) that fails the build if a server-only secret name is found in
client bundle output.

## Data retention and raw payloads

`candidate_application.raw_payload_ref` points to an archived copy of the
raw connector response for audit purposes. Raw payloads are retained
according to the register's own terms of use and Merkwacht's data retention
policy (defined separately in the company's privacy documentation) and must
not be exposed through any customer-facing API — only `platform_operator`
tooling may access them, for debugging connector parsing issues.

## Input validation

All external input (API request bodies, connector responses before they're
mapped into domain types) is validated with `packages/validation` (Zod
schemas) at the boundary — the rest of the codebase can trust that a
`CandidateApplication` or `WatchedTrademark` object in memory already
satisfies its type, rather than re-validating downstream.
