# Stripe-integratie

## Architectuur

Merkwacht gebruikt een **`BillingProvider`**-interface met twee implementaties:

| Provider | Wanneer | Gedrag |
|----------|---------|--------|
| `StripeBillingProvider` | `STRIPE_SECRET_KEY` gezet | Echte Stripe Checkout (kaart + iDEAL) |
| `MockStripeBillingProvider` | Geen key, `NODE_ENV=test` | Fake URL `https://checkout.stripe.test/session` |
| `UnconfiguredBillingProvider` | Geen key, dev/prod | Checkout geeft **503** — geen stille mock-success |

### API-endpoints

- `POST /api/v1/billing/checkout` — body `{ purpose, invoiceId?, plan? }` → `{ url, configured }`
  - `add_payment_method` — Stripe Checkout **setup** mode (kaart + iDEAL opslaan)
  - `pay_invoice` — Stripe Checkout **payment** mode voor openstaande factuur
  - `name_research_order` — Checkout **payment** mode voor een merkonderzoek-order (`nameResearchOrderId` in metadata)
- `POST /api/v1/billing/webhook` — Stripe webhook (raw body + `stripe-signature` header)
  - Verwerkt `checkout.session.completed` (pay_invoice, name_research_order) en `invoice.paid`
  - Schrijft `billing_events` en markeert facturen als betaald / merkonderzoek als betaald (`markPaid`)
- `GET /api/platform/org/billing` — platformoverzicht van alle facturen per organisatie

Legacy mock-endpoint blijft beschikbaar voor demo: `POST /api/v1/invoices/:id/checkout`.

## Testmodus (Stripe-first)

1. Maak een [Stripe test account](https://dashboard.stripe.com/test/apikeys).
2. Zet in `.env` (API):

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_IDS={"starter":"price_...","pro":"price_..."}
```

3. Forward webhooks lokaal:

```bash
stripe listen --forward-to localhost:4000/api/v1/billing/webhook
```

4. Test iDEAL en kaart via Stripe Checkout testmodus ([testkaarten](https://docs.stripe.com/testing)).

Zonder `STRIPE_SECRET_KEY` in development/production retourneert checkout **503** met `BILLING_NOT_CONFIGURED`. In CI/tests (`NODE_ENV=test`) wordt automatisch de mock provider gebruikt.

## UI

- **Klant** `/app/betalingen` — knop **Betaling toevoegen** + **Betalen** op open facturen (opent Checkout URL)
- **Klant** `/app/merkonderzoek/nieuw` — betaling per scan via credit of Checkout (`name_research_order`)
- **Platform** `/platform/betalingen` — facturen over alle organisaties
- **Platform** `/platform/merkonderzoek` — merkonderzoek-orders en voortgang

## Databasevelden (Stripe-ready)

Migratie `20260727121400_org_billing_chat.sql`:

- `workspace_subscriptions.stripe_customer_id`
- `workspace_subscriptions.stripe_subscription_id`
- `invoices.stripe_invoice_id`
- `invoices.hosted_invoice_url`
- `billing_events.provider` (`mock` | `stripe`)

## Nog niet in scope

- Live Customer Portal, automatische subscription billing, tax/VAT-engine, multi-currency.
