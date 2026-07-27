import { describe, expect, it } from 'vitest';
import { NameResearchStore } from './name-research-store.js';

describe('NameResearchStore', () => {
  it('runs BOIP for scoped classes and leaves other registers pending_connector', () => {
    const store = new NameResearchStore({ 'org-1': 1 });
    const { order, checkoutRequired } = store.createOrder({
      organizationId: 'org-1',
      markText: 'WILLEM P',
      intendedNicheNl: 'Software en SaaS in klasse 9/42',
      scopes: [
        { registryCode: 'BOIP', niceClasses: [9, 35, 42] },
        { registryCode: 'EUIPO', niceClasses: [9] },
      ],
      minScoreThreshold: 20,
      useCredit: true,
    });

    expect(checkoutRequired).toBe(false);
    expect(order.status).toBe('completed');
    expect(order.scopes).toHaveLength(2);
    expect(order.intendedNicheNl).toContain('Software');
    expect(order.hits.length).toBeGreaterThan(0);
    expect(order.hits.every((h) => h.registryCode === 'BOIP')).toBe(true);
    expect(order.hits.every((h) => h.applicantName)).toBe(true);
    expect(order.hits.every((h) => h.filingDate)).toBe(true);
    expect(order.hits.every((h) => h.totalRiskScore >= 20)).toBe(true);
    expect(order.progressSteps.find((s) => s.registryCode === 'BOIP')?.status).toBe('completed');
    expect(order.progressSteps.find((s) => s.registryCode === 'EUIPO')?.status).toBe(
      'pending_connector',
    );
    expect(store.getCredits('org-1').balance).toBe(0);
  });

  it('filters out low-score priors below threshold', () => {
    const store = new NameResearchStore({ 'org-1': 1 });
    const low = store.createOrder({
      organizationId: 'org-1',
      markText: 'WILLEM P',
      scopes: [{ registryCode: 'BOIP', niceClasses: [9, 35, 42] }],
      minScoreThreshold: 20,
      useCredit: true,
    }).order;
    const high = store.createOrder({
      organizationId: 'org-1',
      markText: 'WILLEM P',
      scopes: [{ registryCode: 'BOIP', niceClasses: [9, 35, 42] }],
      minScoreThreshold: 90,
      useCredit: false,
    });
    const paid = store.markPaid(high.order.id, 'sess');
    expect(low.hits.length).toBeGreaterThan(paid!.hits.length);
  });

  it('only scans classes for the selected register scope', () => {
    const store = new NameResearchStore({ 'org-1': 1 });
    const { order } = store.createOrder({
      organizationId: 'org-1',
      markText: 'VELORA',
      scopes: [{ registryCode: 'BOIP', niceClasses: [9] }],
      minScoreThreshold: 20,
      useCredit: true,
    });
    // VELORA is class 25 only — should not appear when scope is class 9
    expect(order.hits.every((h) => h.priorMarkText !== 'VELORA')).toBe(true);
  });

  it('prices only from register catalog (no threshold surcharge)', () => {
    const store = new NameResearchStore();
    const a = store.createQuote({
      scopes: [{ registryCode: 'BOIP', niceClasses: [9] }],
    });
    const b = store.createQuote({
      scopes: [{ registryCode: 'BOIP', niceClasses: Array.from({ length: 45 }, (_, i) => i + 1) }],
    });
    expect(a.totalCents).toBe(b.totalCents);
    expect(a.totalCents).toBe(7900);
  });

  it('does not expose TrademarkMatch fields on research orders', () => {
    const store = new NameResearchStore({ 'org-1': 0 });
    const { order } = store.createOrder({
      organizationId: 'org-1',
      markText: 'NOVAFORM',
      scopes: [{ registryCode: 'BOIP', niceClasses: [42] }],
      minScoreThreshold: 40,
      useCredit: false,
    });
    expect(order).not.toHaveProperty('watchedTrademarkId');
    expect(order).not.toHaveProperty('candidate');
    expect(order).not.toHaveProperty('registers');
    expect(order).not.toHaveProperty('niceClasses');
    expect(order.status).toBe('awaiting_payment');

    const paid = store.markPaid(order.id, 'sess_test');
    expect(paid?.status).toBe('completed');
    expect(paid?.hits.some((h) => h.priorMarkText === 'NOVAFORM')).toBe(true);
  });
});
