export interface DossierMatch {
  candidateName: string;
  jurisdiction: string;
  status: string;
  niceClasses: number[];
}

export interface DossierData {
  organizationName: string;
  watchedTrademarkName: string;
  generatedAt: string;
  matches: DossierMatch[];
}

export const DOSSIER_LEGAL_DISCLAIMER_NL =
  'Dit dossier is automatisch gegenereerd door Merkwacht en dient uitsluitend ter ondersteuning van de eigen merkbewaking. ' +
  'Het vormt geen juridisch advies en kan onvolledig of onjuist zijn. Raadpleeg voor een formele beoordeling van ' +
  'merkconflicten of oppositietermijnen altijd een merkengemachtigde of advocaat.';

function escapeHtml(value: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

/** Renders a standalone, printable HTML dossier for a watched trademark. */
export function renderDossierHtml(data: DossierData): string {
  const rows = data.matches
    .map(
      (match) =>
        `<tr><td>${escapeHtml(match.candidateName)}</td><td>${escapeHtml(match.jurisdiction)}</td><td>${escapeHtml(
          match.status,
        )}</td><td>${match.niceClasses.join(', ')}</td></tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<title>Dossier - ${escapeHtml(data.watchedTrademarkName)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #2A2D31; margin: 40px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p { font-size: 13px; color: #5B5F66; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #DEDBD3; padding: 8px; text-align: left; font-size: 13px; }
  th { background: #EFEDE7; }
  .disclaimer { margin-top: 32px; padding: 16px; background: #F7F6F2; border-left: 4px solid #47607A; font-size: 12px; color: #5B5F66; }
</style>
</head>
<body>
  <h1>Dossier: ${escapeHtml(data.watchedTrademarkName)}</h1>
  <p>Organisatie: ${escapeHtml(data.organizationName)}</p>
  <p>Gegenereerd op: ${escapeHtml(data.generatedAt)}</p>
  <table>
    <thead><tr><th>Kandidaat</th><th>Rechtsgebied</th><th>Status</th><th>Nice-klassen</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="disclaimer">${escapeHtml(DOSSIER_LEGAL_DISCLAIMER_NL)}</div>
</body>
</html>`;
}
