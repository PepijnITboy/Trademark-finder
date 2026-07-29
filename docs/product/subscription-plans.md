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

Plannen kunnen via platform **Uitzetten** (`is_active = false`); uitgezette plannen zijn niet kiesbaar voor nieuwe of gewijzigde abonnementen (`listActivePlans` / `changePlan`).

## Merkonderzoek-betaling

Los van abonnementslimieten (bewaakte merken / e-mails):

- Elk betaald merkonderzoek creëert een **factuurrij** zichtbaar onder Betalingen
- Product-UX: rapportenoverzicht + betalen per order (geen credit-saldo in de UI)
- Platform kan facturen markeren als betaald met **verplichte interne notitie** (niet zichtbaar voor de klant)

Zie `docs/product/merkonderzoek.md` en `docs/product/platform-ia.md`.
