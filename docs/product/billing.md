# Billing notes

## Lifecycle
- Subscription: `cancelAtPeriodEnd` keeps access until `currentPeriodEnd`; `nextInvoiceAt` is cleared on cancel.
- Invoices: `draft` → `open` → `paid` (or `void`).
- NL BTW 21% via `computeNlBtw` / line items (`packages/domain/src/billing.ts`).

## Exports
- PDF: `renderInvoicePdf` (`@merkwacht/exports`)
- UBL 2.1 XML: `renderInvoiceUblXml` with VAT category 21%

## Customer UI
- Abonnement: next invoice date, cancel / undo cancel at period end
- Betalingen: excl. BTW / BTW / incl., PDF + UBL download

## Platform
- KlantDetail facturen: mark paid with required internal note (audited)
