# Abonnementen & limieten

Default catalogus (platform mag namen, prijzen en limieten overrulen via `/api/platform/org/plans`):

| Code | Naam (NL) | Max merken | Max e-mails | PDF | Chat | Support |
|------|-----------|------------|-------------|-----|------|---------|
| `basis` | Basis | 1 | 2 | nee | nee | basis |
| `starter` | Starter | 3 | 5 | nee | nee | standaard |
| `plus` | Plus | 10 | 15 | ja | nee | standaard |
| `pro` | Pro | 30 | 40 | ja | ja | prioriteit |
| `enterprise` | Enterprise | 100 | 100 | ja | ja | dedicated |

Harde plafond meldingsadressen: **100**, ook als het plan hoger zou staan.

Enforcement (domain + API):

- Nieuw bewaakt merk → `canAddWatchedTrademark` (HTTP 402)
- Nieuw meldingsadres → `canAddNotificationRecipient`
- PDF / chat → `requireFeature`
- Downgrade geblokkeerd als usage > nieuw limiet; anders `pending_downgrade`

Bron van waarheid in code: `packages/domain/src/subscriptions.ts` (`DEFAULT_PLAN_CATALOG`).

## Merkonderzoek-credits

Los van abonnementslimieten (bewaakte merken / e-mails):

- Standaard start een demo-organisatie met **1 credit**
- **1 credit = 1 volledige merkonderzoek-order** (alle gekozen registers in die order)
- Zonder credit: Stripe Checkout purpose `name_research_order` (iDEAL/kaart)
- Verbruik zichtbaar op `/app/abonnement` en platform `/platform/merkonderzoek` + klantendetail

Zie `docs/product/merkonderzoek.md`.
