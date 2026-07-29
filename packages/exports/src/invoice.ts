/** Invoice PDF + UBL XML exporters for Merkwacht billing. */

export interface InvoiceExportData {
  readonly number: string;
  readonly organizationName: string;
  readonly billingEmail: string;
  readonly description: string;
  readonly exVatCents: number;
  readonly btwCents: number;
  readonly incVatCents: number;
  readonly status: string;
  readonly issuedAt: string;
  readonly dueAt: string | null;
  readonly lineItems: readonly {
    readonly description: string;
    readonly exVatCents: number;
    readonly btwCents: number;
    readonly incVatCents: number;
  }[];
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatEuro(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

function buildContentStream(lines: readonly string[]): string {
  const parts = ['BT', '/F1 11 Tf', '50 780 Td', '14 TL'];
  for (const [index, line] of lines.entries()) {
    if (index > 0) parts.push('T*');
    parts.push(`(${escapePdfText(line)}) Tj`);
  }
  parts.push('ET');
  return parts.join('\n');
}

export function renderInvoicePdf(data: InvoiceExportData): Uint8Array {
  const lines = [
    'Merkwacht — Factuur',
    `Nummer: ${data.number}`,
    `Klant: ${data.organizationName}`,
    `E-mail: ${data.billingEmail}`,
    `Status: ${data.status}`,
    `Datum: ${data.issuedAt}`,
    data.dueAt ? `Vervaldatum: ${data.dueAt}` : '',
    '',
    data.description,
    ...data.lineItems.map(
      (l) => `- ${l.description}: ${formatEuro(l.exVatCents)} + BTW ${formatEuro(l.btwCents)}`,
    ),
    '',
    `Excl. BTW: ${formatEuro(data.exVatCents)}`,
    `BTW 21%: ${formatEuro(data.btwCents)}`,
    `Totaal incl. BTW: ${formatEuro(data.incVatCents)}`,
  ].filter(Boolean);

  const stream = buildContentStream(lines);
  const objects: string[] = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
  );
  objects.push(`4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj`);
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${obj}\n`;
  }
  const xrefStart = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Minimal UBL 2.1 Invoice XML with NL BTW 21%. */
export function renderInvoiceUblXml(data: InvoiceExportData): string {
  const linesXml = data.lineItems
    .map(
      (item, index) => `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="EUR">${(item.exVatCents / 100).toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item><cbc:Description>${escapeXml(item.description)}</cbc:Description></cac:Item>
      <cac:Price><cbc:PriceAmount currencyID="EUR">${(item.exVatCents / 100).toFixed(2)}</cbc:PriceAmount></cac:Price>
    </cac:InvoiceLine>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>${escapeXml(data.number)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(data.issuedAt.slice(0, 10))}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party><cac:PartyName><cbc:Name>Merkwacht B.V.</cbc:Name></cac:PartyName></cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(data.organizationName)}</cbc:Name></cac:PartyName>
      <cac:Contact><cbc:ElectronicMail>${escapeXml(data.billingEmail)}</cbc:ElectronicMail></cac:Contact>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${(data.btwCents / 100).toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${(data.exVatCents / 100).toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${(data.btwCents / 100).toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>21</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${(data.exVatCents / 100).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${(data.exVatCents / 100).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${(data.incVatCents / 100).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${(data.incVatCents / 100).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${linesXml}
</Invoice>
`;
}
