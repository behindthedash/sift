/** Spreadsheet-compatible TSV copy/paste. Tabs/newlines inside cells are quoted. */
export function encodeTsv(rows: unknown[][]): string {
  return rows.map((row) => row.map((value) => {
    const text = value == null ? '' : String(value);
    const safe = /^[\t\r ]*[=+@-]/.test(text) ? `'${text}` : text;
    return /["\t\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }).join('\t')).join('\r\n');
}

export function parseTsv(tsv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let i = 0; i < tsv.length; i++) {
    const ch = tsv[i];
    if (quoted) {
      if (ch === '"' && tsv[i + 1] === '"') { value += '"'; i++; }
      else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"' && value.length === 0) quoted = true;
    else if (ch === '\t') { row.push(value); value = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && tsv[i + 1] === '\n') i++;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += ch;
  }
  if (value !== '' || row.length > 0) { row.push(value); rows.push(row); }
  return rows;
}
