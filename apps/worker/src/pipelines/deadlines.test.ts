import type { OppositionDeadline } from '@merkwacht/domain';
import { createBoipConnector } from '@merkwacht/register-connectors';
import { describe, expect, it } from 'vitest';
import { computeOppositionDeadlineForCandidate, deriveEffectiveProceduralStatus } from './deadlines.js';

const boipConnector = createBoipConnector({ useFixtures: true });

function deadline(startDate: string, deadlineDate: string): OppositionDeadline {
  return {
    candidateApplicationId: 'candidate-1',
    registryCode: 'BOIP',
    startDate,
    deadlineDate,
    ruleSet: { kind: 'months', months: 2, startsFrom: 'publication_date' },
    calculatedAt: new Date().toISOString(),
  };
}

describe('computeOppositionDeadlineForCandidate', () => {
  it("applies BOIP's 2-month-from-publication rule", () => {
    const result = computeOppositionDeadlineForCandidate(
      { id: 'candidate-1', registryCode: 'BOIP', filingDate: '2026-01-01', publicationDate: '2026-05-01' },
      boipConnector,
    );
    expect(result.startDate).toBe('2026-05-01');
    expect(result.deadlineDate).toBe('2026-07-01');
  });
});

describe('deriveEffectiveProceduralStatus', () => {
  it('escalates "published" to "opposition_period" when now falls within the deadline window', () => {
    const result = deriveEffectiveProceduralStatus(
      'published',
      deadline('2026-05-01', '2026-07-01'),
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(result).toBe('opposition_period');
  });

  it('leaves "published" as-is once the deadline window has passed', () => {
    const result = deriveEffectiveProceduralStatus(
      'published',
      deadline('2026-05-01', '2026-07-01'),
      new Date('2026-08-01T00:00:00Z'),
    );
    expect(result).toBe('published');
  });

  it('leaves "published" as-is before the window opens', () => {
    const result = deriveEffectiveProceduralStatus(
      'published',
      deadline('2026-05-01', '2026-07-01'),
      new Date('2026-04-01T00:00:00Z'),
    );
    expect(result).toBe('published');
  });

  it('never downgrades a register-reported status other than "published"', () => {
    for (const status of ['filed', 'registered', 'opposed', 'withdrawn', 'refused', 'expired'] as const) {
      const result = deriveEffectiveProceduralStatus(status, deadline('2026-05-01', '2026-07-01'), new Date('2026-06-01T00:00:00Z'));
      expect(result).toBe(status);
    }
  });

  it('returns the reported status unchanged when there is no deadline yet', () => {
    expect(deriveEffectiveProceduralStatus('published', null)).toBe('published');
  });
});
