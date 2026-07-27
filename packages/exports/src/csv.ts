export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/**
 * Leading characters that spreadsheet applications (Excel, LibreOffice,
 * Google Sheets) interpret as the start of a formula. A cell value that
 * starts with one of these is prefixed with a single quote below to
 * neutralize "CSV/formula injection" (e.g. a candidate's `applicant_name`
 * containing `=cmd|'/c calc'!A1` must render as inert text, never execute).
 */
const FORMULA_INJECTION_PREFIX = /^[=+\-@\t\r]/;

function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  let raw = value === null || value === undefined ? '' : String(value);
  if (FORMULA_INJECTION_PREFIX.test(raw)) {
    raw = `'${raw}`;
  }
  if (/["\n;]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Builds a semicolon-delimited CSV string (semicolon is the common
 * separator for Dutch/EU locale Excel imports). Includes a UTF-8 BOM so
 * Excel opens accented Dutch characters correctly.
 */
export function toCsv<T>(rows: T[], columns: Array<ExportColumn<T>>): string {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(';');
  const lines = rows.map((row) => columns.map((column) => escapeCsvValue(column.value(row))).join(';'));
  return ['\uFEFF' + header, ...lines].join('\r\n');
}
