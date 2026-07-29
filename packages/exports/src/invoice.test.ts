import { describe, expect, it } from 'vitest';
import { renderInvoicePdf, renderInvoiceUblXml, type InvoiceExportData } from './invoice.js';

const sample: InvoiceExportData = {
  number: 'INV-2026-0001',
  organizationName: 'Demo B.V.',
  billingEmail: 'billing@example.com',
  description: 'Abonnement starter',
  exVatCents: 4900,
  btwCents: 1029,
  incVatCents: 5929,
  status: 'open',
  issuedAt: '2026-07-28T10:00:00.000Z',
  dueAt: '2026-08-28',
  lineItems: [
    { description: 'Abonnement starter', exVatCents: 4900, btwCents: 1029, incVatCents: 5929 },
  ],
};

describe('invoice exports', () => {
  it('renders a PDF starting with %PDF', () => {
    const pdf = renderInvoicePdf(sample);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('renders UBL XML with 21% VAT', () => {
    const xml = renderInvoiceUblXml(sample);
    expect(xml).toContain('UBLVersionID');
    expect(xml).toContain('<cbc:Percent>21</cbc:Percent>');
    expect(xml).toContain('INV-2026-0001');
    expect(xml).toContain('49.00');
  });
});
