# Local Development

This guide covers running the full Merkwacht stack locally: `apps/web`,
`apps/api`, `apps/worker`, and a local Supabase instance.

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable` is the easiest way to get the pinned version)
- Docker Desktop (or compatible), required by the Supabase CLI
- Supabase CLI (`brew install supabase/tap/supabase` or see the
  [Supabase CLI docs](https://supabase.com/docs/guides/cli))

## First-time setup

```bash
git clone <repo>
cd "Trademark finder"
pnpm install
cp .env.example .env
```

Edit `.env`:

- For pure local development you can leave `BOIP_API_KEY` and
  `OPENAI_API_KEY` unset — see [`DEV_MODE`](#dev_mode-and-mocked-connectors)
  below.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` should
  point at your local Supabase instance once started (`supabase start`
  prints these values).
- `INTERNAL_JOB_SECRET` can be any long random string locally.

## Database

```bash
pnpm db:setup   # runs migrations, then seeds local data
```

Under the hood this runs `supabase migration up` followed by
`supabase db reset --local`, which applies every file in
`supabase/migrations` and then loads `supabase/seed`. Re-run `pnpm db:setup`
any time you want a clean slate.

To iterate on schema changes:

```bash
supabase migration new <name>          # create a new migration file
pnpm db:migrate                        # apply pending migrations
```

Database-level tests (pgTAP) live in `supabase/tests` — see
[`docs/testing/testing-strategy.md`](../testing/testing-strategy.md).

## Running the apps

```bash
pnpm dev          # runs web + api + worker in parallel
pnpm dev:web      # apps/web only
pnpm dev:api      # apps/api only
pnpm dev:worker   # apps/worker only
```

`apps/web` serves both the customer area (`/app`) and the internal operator
console (`/platform`) from the same Next.js process.

## `DEV_MODE` and mocked connectors

With `DEV_MODE=true` (the default in `.env.example`):

- `packages/register-connectors`' BOIP connector still correctly reports
  `configuration_required` if `BOIP_API_KEY`/`BOIP_API_BASE_URL` are unset
  (dev mode does **not** fabricate register data — see the
  ["no fake data" rule](../connectors/connector-contract.md#health-states--no-fake-data-ever)).
  To exercise the matching/scoring pipeline locally without live BOIP
  credentials, use the fixture-backed connector in `packages/testing`
  instead (`createFixtureBoipConnector()`), wired in by `apps/worker`'s dev
  bootstrap when `DEV_MODE=true` **and** no real BOIP credentials are
  present.
- `packages/ai` short-circuits to `AI_PROVIDER=none` behavior if
  `OPENAI_API_KEY` is unset, regardless of `AI_PROVIDER`'s value, so local
  development never accidentally incurs AI spend.

Set `DEV_MODE=false` to opt into strictly production-like behavior (useful
when testing against real staging credentials).

## Running tests

```bash
pnpm test              # everything
pnpm test:unit         # unit tests only (fast, no external services)
pnpm test:integration  # integration tests (requires local Supabase running)
pnpm test:e2e          # Playwright, requires apps/web running
```

## Linting, formatting, type-checking

```bash
pnpm lint
pnpm format
pnpm typecheck
```

## Common issues

| Symptom | Likely cause |
| --- | --- |
| `apps/api` fails to start with a Supabase connection error | Local Supabase isn't running — run `supabase start`. |
| BOIP connector always shows `configuration_required` even with keys set | Check the key is in `.env` (not just exported in a shell) and that `apps/worker` was restarted after editing `.env`. |
| AI adjustments never appear on matches | Confirm `AI_PROVIDER=openai`, `OPENAI_API_KEY` is set, and `AI_MONTHLY_BUDGET_EUR` hasn't been exhausted — check the `/platform` operational log. |
| `pnpm db:setup` fails | Ensure Docker is running before invoking the Supabase CLI. |
