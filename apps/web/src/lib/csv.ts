export function csvCell(value: string) {
  const safe = /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function csvRows(rows: string[][]) { return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'); }
