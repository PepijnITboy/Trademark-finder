export type ImportPurpose = 'watch' | 'name_research';
export type ImportDayStatus = 'ok' | 'fail' | 'pending' | 'never';

export interface ImportSyncDayInput {
  readonly purpose: ImportPurpose;
  readonly lastSyncAt: string | null;
  readonly lastStatus: 'succeeded' | 'failed' | 'never';
  readonly yesterdayStatus?: ImportDayStatus;
  readonly todayStatus?: ImportDayStatus;
}

function dateKey(iso: string, timeZone = 'Europe/Amsterdam'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function deriveImportDayStatuses(
  input: Pick<ImportSyncDayInput, 'lastSyncAt' | 'lastStatus'>,
  now = new Date(),
): { yesterdayStatus: ImportDayStatus; todayStatus: ImportDayStatus } {
  const today = dateKey(now.toISOString());
  const yesterday = dateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

  if (!input.lastSyncAt || input.lastStatus === 'never') {
    return { yesterdayStatus: 'never', todayStatus: 'pending' };
  }

  const syncDay = dateKey(input.lastSyncAt);
  const mapped: ImportDayStatus =
    input.lastStatus === 'succeeded' ? 'ok' : input.lastStatus === 'failed' ? 'fail' : 'never';

  return {
    yesterdayStatus: syncDay === yesterday ? mapped : syncDay < yesterday ? mapped : 'never',
    todayStatus: syncDay === today ? mapped : 'pending',
  };
}

/** Failures first, then by register code. Watch (daily) vs research (on-demand). */
export function sortImportSyncsForDisplay<T extends ImportSyncDayInput>(rows: readonly T[]): T[] {
  const rank = (row: T): number => {
    const today = row.todayStatus ?? deriveImportDayStatuses(row).todayStatus;
    const yest = row.yesterdayStatus ?? deriveImportDayStatuses(row).yesterdayStatus;
    if (today === 'fail' || yest === 'fail' || row.lastStatus === 'failed') return 0;
    if (today === 'pending' && row.purpose === 'watch') return 1;
    return 2;
  };
  return [...rows].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.purpose.localeCompare(b.purpose);
  });
}

export function splitImportSyncsByPurpose<T extends { purpose: ImportPurpose }>(
  rows: readonly T[],
): { watch: T[]; nameResearch: T[] } {
  return {
    watch: rows.filter((r) => r.purpose === 'watch'),
    nameResearch: rows.filter((r) => r.purpose === 'name_research'),
  };
}
