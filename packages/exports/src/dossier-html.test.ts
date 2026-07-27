import { describe, expect, it } from 'vitest';
import { DOSSIER_LEGAL_DISCLAIMER_NL, renderDossierHtml, type DossierData } from './dossier-html.js';

function buildDossier(overrides: Partial<DossierData> = {}): DossierData {
  return {
    organizationName: 'Demo Organisatie BV',
    watchedTrademarkName: 'LUMARO',
    generatedAt: '2026-07-27T10:00:00.000Z',
    matches: [
      { candidateName: 'LUMARA', jurisdiction: 'BOIP', status: 'new', niceClasses: [9, 42] },
    ],
    ...overrides,
  };
}

describe('renderDossierHtml', () => {
  it('renders a well-formed standalone HTML document', () => {
    const html = renderDossierHtml(buildDossier());

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="nl">');
    expect(html).toContain('LUMARO');
    expect(html).toContain('Demo Organisatie BV');
    expect(html).toContain('LUMARA');
  });

  it('always includes the mandatory legal disclaimer', () => {
    const html = renderDossierHtml(buildDossier());

    expect(html).toContain('class="disclaimer"');
    expect(html).toContain(DOSSIER_LEGAL_DISCLAIMER_NL);
    expect(html).toContain('geen juridisch advies');
  });

  it('includes the disclaimer even when there are no matches', () => {
    const html = renderDossierHtml(buildDossier({ matches: [] }));

    expect(html).toContain(DOSSIER_LEGAL_DISCLAIMER_NL);
    expect(html).toContain('<tbody></tbody>');
  });

  it('HTML-escapes user-controlled fields to prevent markup/script injection', () => {
    const html = renderDossierHtml(
      buildDossier({
        watchedTrademarkName: '<script>alert(1)</script>',
        organizationName: 'Foo & "Bar" <Baz>',
        matches: [{ candidateName: "O'Brien & Co <b>", jurisdiction: 'BOIP', status: 'new', niceClasses: [1] }],
      }),
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Foo &amp; &quot;Bar&quot; &lt;Baz&gt;');
    expect(html).toContain('O&#39;Brien &amp; Co &lt;b&gt;');
  });

  it('renders Nice classes for each match, comma-separated', () => {
    const html = renderDossierHtml(
      buildDossier({ matches: [{ candidateName: 'LUMARA', jurisdiction: 'BOIP', status: 'new', niceClasses: [9, 35, 42] }] }),
    );

    expect(html).toContain('9, 35, 42');
  });
});
