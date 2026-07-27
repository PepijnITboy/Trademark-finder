# Merkonderzoek (pre-filing clearance)

Merkonderzoek is strikt gescheiden van **Merkbescherming** (matches / oppositie
op een al bewaakt merk). Een merkonderzoek scant een *nieuwe* voorgestelde
naam tegen bestaande merken in gekozen registers, **met Nice-klassen per register**.

## Productflow

1. Wizard: merknaam (+ optionele niche) → registers & klassen per register → drempel (filter) → betalen
2. Betaling: **1 credit = 1 volledige order**, of Stripe Checkout purpose `name_research_order`
3. Uitvoering: progress per register; BOIP live (demo-fixtures); overige registers `pending_connector`
4. Rapport: risicoscore, eindadvies, hitlijst met detail (houder, data, scores), disclaimer, CTA **Merk aanvragen via bureau** (chat, geen abonnement vereist)

## Prijs

```
quoteCents = sum(basePriceCents[register])
```

- Drempel heeft **geen** prijsimpact — alleen filter op zichtbare hits + waarschuwing bij lage %
- Platform beheert `basePriceCents` en connectorstatus in `/platform/registers`

## Scopes

```ts
scopes: { registryCode: string; niceClasses: number[] }[]
```

Per register eigen klassen (bv. Benelux 9/35/42 én EUIPO alleen 9). Scan filtert priors op klasse-overlap binnen dat register.

## Domain / API

- Entities: `NameResearchOrder`, `NameResearchHit`, `RegisterCatalogEntry` — **geen** `TrademarkMatch`
- Klant: `/api/v1/name-research/*`
- Platform: `/api/platform/register-catalog`, `/api/platform/name-research` (scopes, niche, voortgang)
- Scoring-profiel: `clearance-v1` (risico aangevallen te worden)

## Disclaimer

Klant-UI en rapporten tonen `NAME_RESEARCH_DISCLAIMER_NL` (geen juridisch advies,
geen registratiegarantie). Zie ook `docs/product/legal-language.md`.

## Non-goals

- Echte online depot-indiening bij BOIP/EUIPO
- Live EUIPO/DE/FR/ES/WIPO connectors in v1 (catalogus + pending wel)
- Hergebruik van `TrademarkMatch` voor research
