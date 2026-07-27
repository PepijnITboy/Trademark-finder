import { describe, expect, it } from 'vitest';
import { renderDossierPdf } from './dossier-pdf.js';

describe('renderDossierPdf', () => {
  it('returns a PDF header and embeds match labels', () => {
    const bytes = renderDossierPdf({
      organizationName: 'Demo Org',
      watchedTrademarkName: 'LUMARO',
      generatedAt: '2026-07-27T12:00:00.000Z',
      totalScore: 78,
      daysRemaining: 12,
      matches: [
        {
          candidateName: 'LUMAROO',
          jurisdiction: 'BOIP',
          status: 'under_review',
          niceClasses: [9, 42],
        },
      ],
    });
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('LUMARO');
    expect(text).toContain('LUMAROO');
    expect(text).toContain('Score: 78%');
  });
});
