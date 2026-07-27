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
  if (days < 0) return `${Math.abs(days)} dagen verstreken`;
  if (days === 0) return 'Vandaag verloopt de termijn';
  if (days === 1) return '1 dag resterend';
  return `${days} dagen resterend`;
}

export function formatPercentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}
