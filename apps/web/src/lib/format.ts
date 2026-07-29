/** Shared, locale-aware (`nl-NL`) formatting helpers used across pages. */

const dateFormatter = new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

export function formatNiceClasses(classes: readonly number[]): string {
  if (classes.length === 0) return '—';
  return classes.join(', ');
}

export function formatDaysRemaining(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—';
  // Approaching-deadline surfaces must never show "verstreken" — expired
  // matches belong in the archive with {@link formatDaysOverdue}.
  if (days < 0) return '—';
  if (days === 0) return 'Vandaag is de oppositiedeadline';
  if (days === 1) return '1 dag tot oppositiedeadline';
  return `${days} dagen tot oppositiedeadline`;
}

/** Copy for archived matches whose opposition window already closed. */
export function formatDaysOverdue(daysOverdue: number): string {
  const days = Math.abs(daysOverdue);
  if (days === 1) return '1 dag verstreken';
  return `${days} dagen verstreken`;
}

export type OverdueSeverity = 'mild' | 'moderate' | 'severe';

export function overdueSeverity(daysOverdue: number): OverdueSeverity {
  const days = Math.abs(daysOverdue);
  if (days <= 7) return 'mild';
  if (days <= 30) return 'moderate';
  return 'severe';
}

export function formatMatchScorePercent(totalScore: number): string {
  return `${Math.round(totalScore)}%`;
}

export function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}
