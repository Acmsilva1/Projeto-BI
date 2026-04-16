/**
 * parsr — leitor CSV mínimo (RFC 4180: aspas, vírgulas, quebras dentro de campo).
 * Sem dependências externas.
 */

/** Remove BOM UTF-8 se existir. */
export function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

/**
 * Faz o parse de um ficheiro CSV completo.
 * @param text conteúdo UTF-8 do ficheiro
 * @param delimiter normalmente `,` ou `;`
 * @returns matriz de células (linhas × colunas)
 */
export function parseCsv(text: string, delimiter: string = ','): string[][] {
  const s = stripBom(String(text ?? ''));
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const delim = delimiter.length === 1 ? delimiter : ',';

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    const next = s[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i += 1;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === delim) {
      pushField();
      continue;
    }
    if (c === '\r' && next === '\n') {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    if (c === '\n' || c === '\r') {
      pushField();
      pushRow();
      continue;
    }
    field += c;
  }
  pushField();
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
    pushRow();
  } else if (rows.length === 0 && row.length === 1 && row[0] === '' && s.trim() === '') {
    return [];
  }
  return rows;
}

/**
 * Uma única linha CSV (sem `\n` no meio do registo; campos podem ter aspas e vírgulas).
 * Usado para leitura em streaming de ficheiros grandes.
 */
export function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const s = stripBom(String(line ?? ''));
  const row: string[] = [];
  let field = '';
  let inQuotes = false;
  const delim = delimiter.length === 1 ? delimiter : ',';

  const pushField = () => {
    row.push(field);
    field = '';
  };

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    const next = s[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i += 1;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === delim) {
      pushField();
      continue;
    }
    if (c === '\r' && next === '\n') {
      break;
    }
    if (c === '\n' || c === '\r') {
      break;
    }
    field += c;
  }
  pushField();
  return row;
}

/** Primeira linha como cabeçalho; restantes como objetos (chave = nome da coluna). */
export function parseCsvObjects(
  text: string,
  delimiter?: string,
): { headers: string[]; rows: Record<string, string>[] } {
  const matrix = parseCsv(text, delimiter);
  if (!matrix.length) return { headers: [], rows: [] };
  const headers = matrix[0].map((h) => String(h ?? '').trim());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const cells = matrix[r];
    const o: Record<string, string> = {};
    headers.forEach((h, j) => {
      o[h] = cells[j] != null ? String(cells[j]) : '';
    });
    rows.push(o);
  }
  return { headers, rows };
}
