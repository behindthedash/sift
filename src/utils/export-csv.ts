export interface CsvExportColumn<TData> {
  id: string;
  label: string;
  getValue: (row: TData) => unknown;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw =
    value instanceof Date
      ? value.toISOString()
      : Array.isArray(value)
        ? value.join('; ')
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);

  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function exportRowsToCsv<TData>(
  rows: TData[],
  columns: CsvExportColumn<TData>[],
  filename = 'data-export.csv'
): void {
  const headerLine = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.getValue(row))).join(',')
  );

  const csvContent = [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
