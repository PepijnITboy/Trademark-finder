# Tenancy isolation test matrix

## Goal

Prove that **OrgAlpha never sees OrgBeta data** (and vice versa), while
members of the same org share workspace data. Platform operators may
aggregate across orgs; non-operators must receive 403.

## How to run

```bash
# Always-on contract + API/DemoStore isolation (CI default)
pnpm tenancy:test

# Optional live RLS against Supabase (requires real service_role)
TENANCY_RLS=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tenancy:test
```

## Suites

| Suite | Location | Requires live DB? | What it covers |
|-------|----------|-------------------|----------------|
| Policy contract matrix | `packages/database/src/tenancy/matrix.contract.test.ts` | No | 100+ generated assertions from `registry.ts` (actors × ops × tables) |
| RLS live matrix | `packages/database/src/tenancy/rls-matrix.test.ts` | Yes (`TENANCY_RLS=1`) | Skips offline with a clear message |
| Store scope contract | `apps/api/src/tenancy/store-scope.contract.test.ts` | No | DemoStore multi-org; cross-tenant get/update → null |
| resolveTenant unit | `apps/api/src/tenancy/resolve-tenant.test.ts` | No | JWT/demo resolve; ignore client org header |
| API isolation | `apps/api/src/tenancy/api-isolation.test.ts` | No | Fastify inject Alpha vs Beta → 404/403 |
| create-store fail-fast | `apps/api/src/store/create-store.test.ts` | No | Placeholder key / probe failure behavior |

## Actors

- `alpha_owner` / `alpha_member` — OrgAlpha (`DEV_SEED_IDS`)
- `beta_owner` — OrgBeta (`DEMO_BETA_IDS`) — **must be denied** on Alpha ids
- `anon` — no access to customer data
- `service_role` — full access (server only; still hand-scoped in app code)
- `platform` — cross-org only with operator check

## Negative cases (must stay green)

- Cross-tenant path ids → 404 (not 200 empty leak)
- List endpoints filter by resolved org
- `x-demo-organization-id` never elevates authority
- Platform routes → 403 for Beta user
- Demo auth headers only when `NODE_ENV=test` or `DEV_DEMO_AUTH=true`
