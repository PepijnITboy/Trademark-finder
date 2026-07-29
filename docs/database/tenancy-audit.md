# Tenancy audit — Trade Finder (`bozjfellwdntglhtyzst`)

Audit date: 2026-07-28. Advisors pulled via Supabase MCP (`get_advisors`).

## Decisions

- Same organization: members share workspace/org data.
- Different customers: never see each other (RLS + service-role query scoping + API tenant resolve).

## Schema drift note

Local migration filenames (`2026072712*`) differ from remote applied versions
(`2026072817*`) because remote applies used MCP `apply_migration` timestamps.
Content is equivalent through `notification_recipient_modes`.

### `notification_recipients` critical columns (remote verified)

| Column | Present |
|--------|---------|
| `notify_mode` | yes |
| `digest_cadence` | yes |
| `min_score_threshold` | yes |
| `digest_frequency` (legacy) | yes |

## Security advisors — remediation status

| Finding | Count | Status |
|---------|-------|--------|
| `pg_graphql_anon_table_exposed` | 78 | **Documented / accepted risk for now** — GraphQL exposure of public objects to `anon`. Prefer locking GraphQL / Data API in production; isolation is enforced by RLS policies + API never using anon for tenant data. Follow-up: restrict GraphQL schema or disable for customer tables. |
| `pg_graphql_authenticated_table_exposed` | 78 | Same as above for `authenticated`. Policy tests remain the source of truth for leaks. |
| `function_search_path_mutable` (`private.set_updated_at`) | 1 | **Fixed** in `20260728190000_tenancy_advisor_hardening.sql` (`SET search_path = ''` + fully-qualified relations). Membership helpers reaffirmed with empty search_path. |

## Performance advisors — remediation status

| Finding | Count | Status |
|---------|-------|--------|
| `unindexed_foreign_keys` | 6 | **Fixed** — indexes added for `billing_events.workspace_id`, `notification_recipient_watches.watched_trademark_id`, `support_messages.participant_id`, `support_threads.organization_id`, `support_threads.trademark_match_id`, `workspace_subscriptions.pending_plan_id`. |
| `multiple_permissive_policies` | 12 | **Documented** — often service_role + member policies by design. Consolidate only when product roles settle; do not merge away service_role documentation policies casually. |
| `unused_index` | 118 | **Deferred** — expected on a fresh schema with little traffic. Revisit after production load. |

## Migration checklist (new tables)

For every new table:

1. Enable RLS.
2. Add workspace/org membership policies (or explicitly deny `authenticated` for register-wide tables).
3. Add service_role policy (or rely on BYPASSRLS — document which).
4. Add FK indexes when referencing tenant keys.
5. Set `search_path` on any new `security definer` functions.
6. Add entries to `packages/database/src/tenancy/registry.ts` and extend the matrix.
7. Ensure `AppStore` / route handlers always scope by `organizationId` or `workspace_id` from **server-resolved** tenant context (never client-supplied org id as authority).

## Applied hardening migration

- Local: `supabase/migrations/20260728190000_tenancy_advisor_hardening.sql`
- Remote: applied via MCP as `tenancy_advisor_hardening` on project `bozjfellwdntglhtyzst`
