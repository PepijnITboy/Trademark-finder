# Merkwacht

Merkwacht is een Nederlandse/Benelux SaaS-dienst waarmee merkhouders en
merkgemachtigden automatisch worden gewaarschuwd zodra er nieuwe
merkaanvragen worden gepubliceerd die conflicteren met hun eigen,
geregistreerde merken. Merkwacht bewaakt registers (te beginnen met BOIP),
berekent een conflictscore per aanvraag en signaleert wanneer de
oppositietermijn dreigt te verstrijken.

> **Let op — geen juridisch advies.** Merkwacht is een signaleringsdienst.
> De output van het platform vervangt nooit het advies van een merkengemachtigde
> of advocaat. Zie [`docs/product/legal-language.md`](docs/product/legal-language.md)
> voor de exacte voorwaarden waaronder we wel/niet mogen communiceren.

## Inhoudsopgave

- [Snel starten](#snel-starten)
- [Twee omgevingen: `/app` en `/platform`](#twee-omgevingen-app-en-platform)
- [Architectuur in het kort](#architectuur-in-het-kort)
- [Monorepo-indeling](#monorepo-indeling)
- [Testen](#testen)
- [Belangrijke documentatie](#belangrijke-documentatie)
- [Scripts](#scripts)

## Snel starten

Vereisten: Node.js 20+, pnpm 9+, Docker (voor de lokale Supabase-stack) en de
Supabase CLI.

```bash
# 1. Installeer dependencies voor de hele monorepo
pnpm install

# 2. Kopieer de omgevingsvariabelen en vul de benodigde waarden in
cp .env.example .env

# 3. Start de lokale database (migraties + seed-data)
pnpm db:setup

# 4. Start web, api en worker gelijktijdig
pnpm dev
```

Standaard draait Merkwacht lokaal in `DEV_MODE=true`. In deze modus worden
externe registerconnectors (zoals BOIP) en de AI-verrijkingslaag gemocked,
zodat je zonder API-sleutels kunt ontwikkelen. Zie
[`docs/operations/local-development.md`](docs/operations/local-development.md)
voor details.

## Twee omgevingen: `/app` en `/platform`

Merkwacht bestaat uit twee losse front-end omgevingen die dezelfde API en
database delen, maar een volledig andere doelgroep en toegangsmodel hebben:

- **`/app`** — de klantomgeving. Hier beheren merkhouders hun bewaakte merken
  (`watched_trademark`), bekijken ze gevonden treffers (`trademark_match`) en
  stellen ze notificatievoorkeuren in. Toegang via reguliere gebruikersaccounts
  met abonnement-gebonden functiebeperkingen (zie
  [`docs/domain/trademark-model.md`](docs/domain/trademark-model.md)).
- **`/platform`** — de interne beheeromgeving voor het Merkwacht-team. Hier
  worden connectorstatus, jobqueues, scoring-kwaliteit, klantabonnementen en
  supportverzoeken gemonitord en beheerd. Toegang is beperkt tot interne
  operators met een aparte rol.

Beide omgevingen zijn losse routes/apps binnen `apps/web`, maar delen
componenten uit `packages/ui` en domeinlogica uit `packages/domain`.

## Architectuur in het kort

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   apps/web  │────▶│  apps/api   │────▶│  Supabase     │
│ (/app +     │     │ (REST/RPC)  │     │  (Postgres +  │
│  /platform) │     │             │     │   Auth)       │
└─────────────┘     └─────────────┘     └──────┬───────┘
                                                │
                     ┌─────────────┐            │
                     │ apps/worker │◀───────────┘
                     │ (dagelijkse │
                     │  jobs)      │
                     └──────┬──────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
     register-connectors  scoring       notifications
        (BOIP, ...)    (normalization,  (e-mail, in-app)
                         phonetics,
                         opposition-rules,
                         ai)
```

De worker haalt dagelijks nieuwe merkpublicaties op via de
`register-connectors`, matcht ze tegen bewaakte merken, berekent een
conflictscore via de `scoring`-pipeline en stuurt notificaties uit. Zie
[`docs/architecture/overview.md`](docs/architecture/overview.md) voor het
volledige verhaal en [`docs/architecture/module-boundaries.md`](docs/architecture/module-boundaries.md)
voor de regels rond package-afhankelijkheden.

## Monorepo-indeling

```
apps/
  web/                 # Vue 3 + Vite front-end: /app (klant) + /platform (intern)
    src/
      layouts/         # CustomerLayout.vue (/app) en PlatformLayout.vue (/platform)
      pages/           # Route-componenten per omgeving (customer/, platform/)
      components/      # Gedeelde UI-bouwstenen binnen apps/web
      api/             # Vue Query hooks/clients voor apps/api
      router/          # vue-router configuratie
      stores/          # Pinia stores (bv. thema)
    e2e/               # Playwright smoke-tests (zie "Testen" hieronder)
  api/                 # Fastify API-laag (REST) bovenop Supabase
  worker/              # Dagelijkse achtergrondtaken (cron/queue)
packages/
  domain/              # Kernmodellen: watched_trademark, matches, jobs, etc.
  register-connectors/ # Registerintegraties (BOIP e.a.) achter één contract
  normalization/        # Merknaam-normalisatie
  phonetics/            # Fonetische representaties (Nederlands/Engels)
  scoring/              # Score-pipeline (regels + AI-laag)
  opposition-rules/     # Oppositietermijn-berekeningen
  ai/                   # AI-provider-abstractie + budgetbewaking
  database/             # Supabase/Postgres-client, types, repositories
  exports/              # PDF/CSV-exports voor klanten
  notifications/        # E-mail/in-app notificatiekanalen
  logging/              # Gedeelde logging-utilities
  shared/               # Kleine, generieke helpers
  validation/           # Zod-schema's en validatie-utilities
  ui/                   # Gedeelde React-componenten
  config/               # Gedeelde configuratie (env-parsing, constants)
  testing/              # Test-utilities en fixtures
supabase/
  migrations/           # SQL-migraties
  seed/                 # Seed-data voor lokale ontwikkeling
  tests/                # pgTAP / database-tests
docs/                   # Architectuur-, domein- en productdocumentatie
```

## Testen

```bash
pnpm test          # unit- en integratietests voor alle packages/apps (Vitest)
pnpm test:unit     # alleen unit tests
pnpm test:e2e      # Playwright smoke-tests voor apps/web
```

`pnpm test` draait Vitest in elk package/app (`packages/exports`, `packages/phonetics`,
`apps/api`, ...); packages zonder tests slagen automatisch dankzij
`--passWithNoTests`.

`pnpm test:e2e` draait de Playwright-smoke-suite in
[`apps/web/e2e/smoke.spec.ts`](apps/web/e2e/smoke.spec.ts). De Playwright-config
(`apps/web/playwright.config.ts`) start automatisch een Vite dev-server op
`http://localhost:5173`, dus de suite werkt **zonder** dat `apps/api` of Supabase
draaien — de smoke-tests controleren de statische UI-schil (branding,
paginatitels, navigatie, het thema-toggle) die synchroon rendert, ongeacht of
databronnen bereikbaar zijn. Om ook data-afhankelijke schermen (tabellen, KPI's)
tegen echte responses te testen, start eerst de volledige stack (`pnpm dev` of
minstens `pnpm dev:api`) voordat je `pnpm test:e2e` draait.

Eenmalig, voordat je Playwright voor het eerst gebruikt, moet je de
browserbinaries installeren (vereist netwerktoegang):

```bash
pnpm --filter @merkwacht/web exec playwright install chromium
```

## Belangrijke documentatie

- [`docs/architecture/overview.md`](docs/architecture/overview.md) — systeemoverzicht
- [`docs/domain/trademark-model.md`](docs/domain/trademark-model.md) — kernbegrippen
- [`docs/database/schema.md`](docs/database/schema.md) — volledig databaseschema
- [`docs/connectors/connector-contract.md`](docs/connectors/connector-contract.md) — connectorcontract
- [`docs/scoring/overview.md`](docs/scoring/overview.md) — scoring-pipeline
- [`docs/security/security-model.md`](docs/security/security-model.md) — security- en RLS-model
- [`docs/product/legal-language.md`](docs/product/legal-language.md) — verplichte disclaimers

## Scripts

| Commando              | Omschrijving                                              |
| --------------------- | ---------------------------------------------------------- |
| `pnpm install`         | Installeer alle dependencies in de monorepo                |
| `pnpm dev`             | Start `web`, `api` en `worker` gelijktijdig                 |
| `pnpm db:setup`        | Voer migraties uit en laad seed-data                        |
| `pnpm db:migrate`      | Voer alleen migraties uit                                   |
| `pnpm db:seed`         | Reset lokale database en laad seed-data                     |
| `pnpm build`           | Bouw alle packages/apps                                     |
| `pnpm lint`            | Lint de volledige monorepo                                  |
| `pnpm typecheck`       | Typecontrole voor de volledige monorepo                     |
| `pnpm test`            | Voer alle tests uit                                          |
| `pnpm test:unit`       | Voer alleen unit tests uit                                   |
| `pnpm test:integration`| Voer alleen integratietests uit                              |
| `pnpm test:e2e`        | Voer end-to-end tests uit (Playwright, `apps/web`)           |
| `pnpm format`          | Formatteer de codebase met Prettier                          |

## Licentie

Propriëtaire software. Alle rechten voorbehouden aan Merkwacht.
