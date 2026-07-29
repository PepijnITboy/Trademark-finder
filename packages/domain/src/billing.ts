/** NL BTW (VAT) is a flat 21% on Merkwacht's subscription and merkonderzoek pricing. */
export const NL_BTW_RATE = 0.21;

export interface NlBtwBreakdown {
  readonly exVatCents: number;
  readonly btwCents: number;
  readonly incVatCents: number;
}

/** Computes the NL BTW (21%) breakdown for an ex-VAT amount, in cents. */
export function computeNlBtw(exVatCents: number): NlBtwBreakdown {
  if (exVatCents < 0) {
    throw new Error('exVatCents mag niet negatief zijn.');
  }
  const btwCents = Math.round(exVatCents * NL_BTW_RATE);
  return { exVatCents, btwCents, incVatCents: exVatCents + btwCents };
}

/**
 * Splits a legacy inc-VAT total (e.g. a pre-existing `amountCents` price)
 * back into its NL BTW (21%) parts. Prefer {@link computeNlBtw} when the
 * ex-VAT price is already known; this is only for backfilling older
 * inc-VAT-only amounts.
 */
export function deriveNlBtwFromIncVat(incVatCents: number): NlBtwBreakdown {
  if (incVatCents < 0) {
    throw new Error('incVatCents mag niet negatief zijn.');
  }
  const exVatCents = Math.round(incVatCents / (1 + NL_BTW_RATE));
  return { exVatCents, btwCents: incVatCents - exVatCents, incVatCents };
}

export interface InvoiceLineItemInput {
  readonly description: string;
  readonly exVatCents: number;
}

export interface InvoiceLineItem extends NlBtwBreakdown {
  readonly description: string;
}

/** Attaches a per-line NL BTW breakdown to each invoice line item. */
export function buildInvoiceLineItems(items: readonly InvoiceLineItemInput[]): readonly InvoiceLineItem[] {
  return items.map((item) => ({ description: item.description, ...computeNlBtw(item.exVatCents) }));
}

/** Sums ex-VAT, BTW, and inc-VAT totals across a set of already-computed line items. */
export function sumInvoiceLineItems(items: readonly NlBtwBreakdown[]): NlBtwBreakdown {
  return items.reduce<NlBtwBreakdown>(
    (acc, item) => ({
      exVatCents: acc.exVatCents + item.exVatCents,
      btwCents: acc.btwCents + item.btwCents,
      incVatCents: acc.incVatCents + item.incVatCents,
    }),
    { exVatCents: 0, btwCents: 0, incVatCents: 0 },
  );
}
