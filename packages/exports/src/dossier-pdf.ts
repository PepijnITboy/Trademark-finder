import { DOSSIER_LEGAL_DISCLAIMER_NL, type DossierData } from './dossier-html.js';

/**
 * Minimal PDF writer (single page, Helvetica) — no native deps so CI stays light.
 * Sufficient for match-dossier downloads; HTML export remains the rich printable form.
 */
function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
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

export function renderDossierPdf(data: DossierData & { totalScore?: number; daysRemaining?: number | null }): Uint8Array {
  const match = data.matches[0];
  const lines = [
    'Merkwacht — Matchdossier',
    `Eigenmerk: ${data.watchedTrademarkName}`,
    `Match gevonden: ${match?.candidateName ?? '—'}`,
    `Register: ${match?.jurisdiction ?? '—'}`,
    `Status: ${match?.status ?? '—'}`,
    `Nice-klassen: ${match?.niceClasses.join(', ') || '—'}`,
    data.totalScore !== undefined ? `Score: ${Math.round(data.totalScore)}%` : '',
    data.daysRemaining !== undefined && data.daysRemaining !== null
      ? `Dagen tot oppositietermijn: ${data.daysRemaining}`
      : '',
    `Organisatie: ${data.organizationName}`,
    `Gegenereerd: ${data.generatedAt}`,
    '',
    DOSSIER_LEGAL_DISCLAIMER_NL.slice(0, 220) + '…',
  ].filter((line) => line.length > 0);

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
