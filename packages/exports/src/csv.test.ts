import { describe, expect, it } from 'vitest';
import { toCsv, type ExportColumn } from './csv.js';

interface Row {
  name: string;
  score: number;
}

const columns: ExportColumn<Row>[] = [
  { header: 'Naam', value: (row) => row.name },
  { header: 'Score', value: (row) => row.score },
];

describe('toCsv', () => {
  it('renders a semicolon-delimited CSV with a UTF-8 BOM and header row', () => {
    const csv = toCsv<Row>([{ name: 'LUMARO', score: 87 }], columns);
    const lines = csv.split('\r\n');

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(lines[0]).toBe('\uFEFFNaam;Score');
    expect(lines[1]).toBe('LUMARO;87');
  });

  it('renders one row per input row, in order', () => {
    const csv = toCsv<Row>(
      [
        { name: 'LUMARO', score: 87 },
        { name: 'VANTERO', score: 42 },
      ],
      columns,
    );
    const lines = csv.split('\r\n');

    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('LUMARO;87');
    expect(lines[2]).toBe('VANTERO;42');
  });

  it('quotes values containing the delimiter, quotes, or newlines', () => {
    const csv = toCsv<Row>([{ name: 'Foo; "Bar"\nBaz', score: 1 }], columns);
    const lines = csv.split('\r\n');

    expect(lines[1]).toBe('"Foo; ""Bar""\nBaz";1');
  });

  it('renders null/undefined values as empty cells', () => {
    const nullableColumns: ExportColumn<{ note: string | null }>[] = [{ header: 'Notitie', value: (row) => row.note }];
    const csv = toCsv([{ note: null }], nullableColumns);

    expect(csv.split('\r\n')[1]).toBe('');
  });

  describe('formula injection escaping', () => {
    it.each([
      ['=cmd|\' /C calc\'!A1', "'=cmd|' /C calc'!A1"],
      ['=1+1', "'=1+1"],
      ['+1+1', "'+1+1"],
      ['-1+1', "'-1+1"],
      ['@SUM(A1:A2)', "'@SUM(A1:A2)"],
    ])('prefixes a leading %s with a single quote so it is not read as a formula', (raw, expected) => {
      const csv = toCsv<{ value: string }>([{ value: raw }], [{ header: 'Veld', value: (row) => row.value }]);
      expect(csv.split('\r\n')[1]).toBe(expected);
    });

    it('does not mangle ordinary values that merely contain (but do not start with) formula characters', () => {
      const csv = toCsv<{ value: string }>(
        [{ value: 'Merk A+B' }],
        [{ header: 'Veld', value: (row) => row.value }],
      );
      expect(csv.split('\r\n')[1]).toBe('Merk A+B');
    });

    it('quotes an escaped formula value that also contains the delimiter', () => {
      const csv = toCsv<{ value: string }>(
        [{ value: '=cmd;calc' }],
        [{ header: 'Veld', value: (row) => row.value }],
      );
      expect(csv.split('\r\n')[1]).toBe('"\'=cmd;calc"');
    });
  });
});
