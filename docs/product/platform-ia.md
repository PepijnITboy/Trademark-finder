# Platform IA: systeem · operatie · klant

Platformbeheer volgt drie lagen. Meng ze niet in navigatie of schermen.

## Systeem (catalogus)

- **Abonnementen** — planprijzen, limieten, **Uitzetten** (`is_active`)
- **Prijzen** — vrije register-/productprijzen (los van health)
- **Systeeminstellingen** / **Auditlog**

## Operatie (runtime)

- **Registers & koppelingen** — connector health + flags (geen prijs-±)
- **Imports** — laatste sync per register, Merkbescherming vs Merkonderzoek
- **Matches & scoring**, **AI & kosten**, **Jobs & fouten**
- **Notificaties** — platform → klant in-app versturen + bezorglog (geen chat)

## Klant (profiel)

- **Klanten** lijst → `/platform/klanten/:orgId` vol profiel
- Tabs: Profiel, Accounts, Abonnement (force), Meldingen, Merken, Merkonderzoek-rapporten, Facturen (markeer betaald + interne notitie), Chat, Audit
- Losse top-nav voor Accounts / Betalingen / Merkonderzoek / Chat / Exports is verwijderd; content leeft op klantdetail

## API

- `GET /api/platform/organizations` — lijst
- `GET /api/platform/organizations/:id` — aggregaat
- `POST /api/platform/org/billing/:orgId/invoices/:id/mark-paid` — vereist `internalNote`
- `POST /api/platform/org/notifications` — in-app versturen
- `GET /api/platform/import-syncs` — importmonitoring
