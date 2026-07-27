import { describe, expect, it } from 'vitest';
import { DEFAULT_REGISTER_CATALOG, registersForNameResearch } from './register-catalog.js';
import {
  adviceBandFromRisk,
  clearanceRiskScore,
  quoteNameResearch,
  shouldWarnLargeReport,
  validateNameResearchScopes,
} from './name-research.js';

describe('name research pricing', () => {
  it('sums only register base prices — threshold does not affect price', () => {
    const quote = quoteNameResearch({
      scopes: [{ registryCode: 'BOIP', niceClasses: [9, 35] }],
      catalog: DEFAULT_REGISTER_CATALOG,
    });
    expect(quote.registerSubtotalCents).toBe(7900);
    expect(quote.totalCents).toBe(7900);
    expect(quote.lineItems).toHaveLength(1);
  });

  it('sums multiple registers without class or threshold surcharges', () => {
    const quote = quoteNameResearch({
      scopes: [
        { registryCode: 'BOIP', niceClasses: Array.from({ length: 45 }, (_, i) => i + 1) },
        { registryCode: 'EUIPO', niceClasses: [9] },
      ],
      catalog: DEFAULT_REGISTER_CATALOG,
    });
    expect(quote.totalCents).toBe(7900 + 9900);
    expect(quote.lineItems).toHaveLength(2);
  });

  it('rejects empty scopes and empty class lists', () => {
    expect(() =>
      quoteNameResearch({ scopes: [], catalog: DEFAULT_REGISTER_CATALOG }),
    ).toThrow(/minstens één register/i);
    expect(() =>
      validateNameResearchScopes([{ registryCode: 'BOIP', niceClasses: [] }]),
    ).toThrow(/Nice-klasse/i);
  });

  it('rejects disabled registers', () => {
    const catalog = DEFAULT_REGISTER_CATALOG.map((r) =>
      r.code === 'EUIPO' ? { ...r, connectorStatus: 'disabled' as const } : r,
    );
    expect(() =>
      quoteNameResearch({
        scopes: [{ registryCode: 'EUIPO', niceClasses: [9] }],
        catalog,
      }),
    ).toThrow(/niet beschikbaar/i);
  });
});

describe('shouldWarnLargeReport', () => {
  it('warns below 40% and not at or above', () => {
    expect(shouldWarnLargeReport(20)).toBe(true);
    expect(shouldWarnLargeReport(39)).toBe(true);
    expect(shouldWarnLargeReport(40)).toBe(false);
    expect(shouldWarnLargeReport(80)).toBe(false);
  });
});

describe('clearanceRiskScore', () => {
  it('scores similar names higher than unrelated ones', () => {
    const similar = clearanceRiskScore('WILLEM P', 'WILLEMPE', true);
    const unrelated = clearanceRiskScore('WILLEM P', 'KASTORIN', false);
    expect(similar.totalRiskScore).toBeGreaterThan(unrelated.totalRiskScore);
    expect(similar.totalRiskScore).toBeGreaterThan(40);
  });
});

describe('advice + catalog', () => {
  it('maps risk bands', () => {
    expect(adviceBandFromRisk(80)).toBe('high');
    expect(adviceBandFromRisk(45)).toBe('medium');
    expect(adviceBandFromRisk(10)).toBe('low');
  });

  it('exposes research-enabled registers including coming_soon', () => {
    const list = registersForNameResearch(DEFAULT_REGISTER_CATALOG);
    expect(list.some((r) => r.code === 'BOIP')).toBe(true);
    expect(list.some((r) => r.code === 'EUIPO')).toBe(true);
    expect(list.every((r) => r.connectorStatus !== 'disabled')).toBe(true);
  });
});
