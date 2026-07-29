import { describe, expect, it } from 'vitest';
import {
  buildInvoiceLineItems,
  computeNlBtw,
  deriveNlBtwFromIncVat,
  NL_BTW_RATE,
  sumInvoiceLineItems,
} from './billing.js';

describe('computeNlBtw', () => {
  it('applies the 21% NL BTW rate to an ex-VAT amount', () => {
    const breakdown = computeNlBtw(4900);
    expect(breakdown).toEqual({ exVatCents: 4900, btwCents: 1029, incVatCents: 5929 });
  });

  it('rounds BTW cents to the nearest whole cent', () => {
    const breakdown = computeNlBtw(9999);
    expect(breakdown.btwCents).toBe(Math.round(9999 * NL_BTW_RATE));
    expect(breakdown.incVatCents).toBe(breakdown.exVatCents + breakdown.btwCents);
  });

  it('returns zero BTW for a zero amount', () => {
    expect(computeNlBtw(0)).toEqual({ exVatCents: 0, btwCents: 0, incVatCents: 0 });
  });

  it('rejects negative amounts', () => {
    expect(() => computeNlBtw(-100)).toThrow();
  });
});

describe('deriveNlBtwFromIncVat', () => {
  it('splits a legacy inc-VAT total into ex-VAT and BTW parts that sum back exactly', () => {
    const breakdown = deriveNlBtwFromIncVat(9900);
    expect(breakdown.incVatCents).toBe(9900);
    expect(breakdown.exVatCents + breakdown.btwCents).toBe(9900);
    expect(breakdown.exVatCents).toBe(8182);
    expect(breakdown.btwCents).toBe(1718);
  });

  it('returns zeroes for a zero amount', () => {
    expect(deriveNlBtwFromIncVat(0)).toEqual({ exVatCents: 0, btwCents: 0, incVatCents: 0 });
  });
});

describe('buildInvoiceLineItems', () => {
  it('attaches a BTW breakdown to every line item', () => {
    const lines = buildInvoiceLineItems([
      { description: 'Merkwacht Pro — maandelijks abonnement', exVatCents: 14900 },
      { description: 'Merkonderzoek: LUMARO', exVatCents: 9900 },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      description: 'Merkwacht Pro — maandelijks abonnement',
      exVatCents: 14900,
      btwCents: 3129,
      incVatCents: 18029,
    });
    expect(lines[1]!.incVatCents).toBe(lines[1]!.exVatCents + lines[1]!.btwCents);
  });
});

describe('sumInvoiceLineItems', () => {
  it('sums ex-VAT, BTW, and inc-VAT across line items', () => {
    const lines = buildInvoiceLineItems([
      { description: 'A', exVatCents: 1000 },
      { description: 'B', exVatCents: 2000 },
    ]);
    expect(sumInvoiceLineItems(lines)).toEqual({ exVatCents: 3000, btwCents: 630, incVatCents: 3630 });
  });

  it('returns zeroes for an empty list', () => {
    expect(sumInvoiceLineItems([])).toEqual({ exVatCents: 0, btwCents: 0, incVatCents: 0 });
  });
});
