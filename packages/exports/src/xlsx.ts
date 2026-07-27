import ExcelJS from 'exceljs';
import type { ExportColumn } from './csv';

/**
 * Renders rows into a real `.xlsx` workbook using ExcelJS. Returns a
 * Node `Buffer` ready to be sent as an HTTP attachment or written to disk.
 */
export async function toXlsxBuffer<T>(
  rows: T[],
  columns: Array<ExportColumn<T>>,
  sheetName = 'Export',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Merkwacht';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.header, width: 24 }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(columns.map((column) => column.value(row) ?? ''));
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
