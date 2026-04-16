/** BOM UTF-8 — Excel em PT-BR reconhece acentos ao abrir o ficheiro. */
const BOM = '\uFEFF';

/**
 * Número finito arredondado para CSV (evita dezenas de casas de artefatos float).
 * @returns {number|''}
 */
export function roundCsvNumber(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number(n.toFixed(decimals));
}

export function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

/**
 * @param {string} filename - com ou sem `.csv`
 * @param {Array<Array<string|number|boolean>>} rows - primeira linha = cabeçalhos
 */
export function downloadCsv(filename, rows) {
  if (!rows?.length) return;
  const name = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const csv = BOM + rowsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** `slug-YYYY-MM-DD` para nomes de ficheiro estáveis. */
export function datedExportBasename(slug) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const base = String(slug || 'export')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'export'}-${y}-${m}-${day}`;
}
