import type { OppositionDeadline, OppositionRuleSet } from '@merkwacht/domain';

export interface CalculateOppositionDeadlineInput {
  readonly candidateApplicationId: string;
  readonly registryCode: string;
  /** ISO `YYYY-MM-DD` filing date. */
  readonly filingDate: string;
  /** ISO `YYYY-MM-DD` publication date. */
  readonly publicationDate: string;
  readonly ruleSet: OppositionRuleSet;
}

function parseIsoDate(iso: string): Date {
  const parts = iso.slice(0, 10).split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined || Number.isNaN(year)) {
    throw new RangeError(`invalid ISO date: "${iso}"`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds a whole number of calendar days to `date`, in UTC. */
function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Adds a whole number of calendar months to `date`, in UTC, clamping to the
 * last valid day of the target month when the source day doesn't exist
 * there (e.g. 31 Jan + 1 month = 28/29 Feb). See
 * `docs/domain/opposition-workflow.md`.
 */
function addCalendarMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

  const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  return new Date(Date.UTC(targetYear, normalizedMonth, clampedDay));
}

/**
 * Computes the {@link OppositionDeadline} for a candidate application given
 * a register's {@link OppositionRuleSet}. Pure function — see
 * `docs/domain/opposition-workflow.md` for the domain rationale and
 * `docs/connectors/boip.md` for BOIP's specific 2-month rule.
 */
export function calculateOppositionDeadline(
  input: CalculateOppositionDeadlineInput,
): OppositionDeadline {
  const startDateIso =
    input.ruleSet.startsFrom === 'publication_date' ? input.publicationDate : input.filingDate;
  const startDate = parseIsoDate(startDateIso);

  const deadlineDate =
    input.ruleSet.kind === 'calendar_days'
      ? addCalendarDays(startDate, input.ruleSet.days)
      : addCalendarMonths(startDate, input.ruleSet.months);

  return {
    candidateApplicationId: input.candidateApplicationId,
    registryCode: input.registryCode,
    startDate: formatIsoDate(startDate),
    deadlineDate: formatIsoDate(deadlineDate),
    ruleSet: input.ruleSet,
    calculatedAt: new Date().toISOString(),
  };
}
