import { describe, expect, it } from 'vitest';
import { clearanceRiskScore, adviceBandFromRisk } from '@merkwacht/domain';
import { clearanceRiskScoreViaSharedEngine } from './clearance-adapter.js';

describe('clearanceRiskScoreViaSharedEngine parity direction', () => {
  it('ranks similar names above unrelated ones like legacy clearanceRiskScore', () => {
    const sharedSimilar = clearanceRiskScoreViaSharedEngine('WILLEM P', 'WILLEMPE', true);
    const sharedUnrelated = clearanceRiskScoreViaSharedEngine('WILLEM P', 'KASTORIN', false);
    const legacySimilar = clearanceRiskScore('WILLEM P', 'WILLEMPE', true);
    const legacyUnrelated = clearanceRiskScore('WILLEM P', 'KASTORIN', false);

    expect(sharedSimilar.totalRiskScore).toBeGreaterThan(sharedUnrelated.totalRiskScore);
    expect(legacySimilar.totalRiskScore).toBeGreaterThan(legacyUnrelated.totalRiskScore);
    expect(adviceBandFromRisk(sharedSimilar.totalRiskScore)).toBeDefined();
  });

  it('ZENZO / SENZO stays a meaningful hit', () => {
    const result = clearanceRiskScoreViaSharedEngine('ZENZO', 'SENZO', true);
    expect(result.totalRiskScore).toBeGreaterThan(40);
    expect(result.featureVersion).toBeTruthy();
  });
});
