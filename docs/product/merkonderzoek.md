# Merkonderzoek (pre-filing clearance)

Merkonderzoek is strikt gescheiden van **Merkbescherming** (matches / oppositie
op een al bewaakt merk). Een merkonderzoek scant een *nieuwe* voorgestelde
naam tegen bestaande merken in gekozen registers, **met Nice-klassen per register**.

## Productflow

1. Wizard: merknaam → registers & klassen per register (**Alle klassen** als full-width primaire actie) → toelichting (optioneel) → **betalen**
2. Hit-filter: vaste interne drempel `NAME_RESEARCH_DEFAULT_THRESHOLD` (40%) — geen drempel-UI in de wizard
3. Betaling: **per order** (Stripe Checkout purpose `name_research_order`); altijd een factuurrij in Betalingen
4. Uitvoering: progress per register; BOIP live (demo-fixtures); overige registers `pending_connector`
5. Rapport: risicoscore, eindadvies, hitlijst met detail (houder, data, scores), disclaimer, CTA **Merk aanvragen via bureau** (chat, geen abonnement vereist)

Product-UX toont **rapporten + betaling** — geen credit-saldo of “1 credit gebruiken” in de UI. Backend credits mogen intern blijven voor migratie.

## Prijs

```
quoteCents = sum(basePriceCents[register])
```

- Drempel heeft **geen** prijsimpact — alleen filter op zichtbare hits
- Platform beheert `basePriceCents` onder **Systeem → Prijzen**; connector health onder **Operatie → Registers**

## Scopes

```ts
scopes: { registryCode: string; niceClasses: number[] }[]
```

Per register eigen klassen (bv. Benelux 9/35/42 én EUIPO alleen 9). Scan filtert priors op klasse-overlap binnen dat register.

## Domain / API

- Entities: `NameResearchOrder`, `NameResearchHit`, `RegisterCatalogEntry` — **geen** `TrademarkMatch`
- Klant: `/api/v1/name-research/*`
- Platform: `/api/platform/register-catalog`, orderfeed via klantdetail / operatie-aggregaten
- Scoring-profiel: `clearance-v1` (risico aangevallen te worden)
- API-veld `intendedNicheNl` blijft voor compat; UI noemt dit **toelichting**

## Disclaimer

Klant-UI en rapporten tonen `NAME_RESEARCH_DISCLAIMER_NL` (geen juridisch advies,
geen registratiegarantie). Zie ook `docs/product/legal-language.md`.

## Non-goals

- Echte online depot-indiening bij BOIP/EUIPO
- Live EUIPO/DE/FR/ES/WIPO connectors in v1 (catalogus + pending wel)
- Hergebruik van `TrademarkMatch` voor research
- Drempel terug in de wizard-UI
- Credit-balans als productconcept in de UI
