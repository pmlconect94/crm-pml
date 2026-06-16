/**
 * Generador de Excel (.xlsx) sin dependencias.
 *
 * Produce un archivo OOXML SpreadsheetML real — no un CSV — para que abra
 * limpio en Excel (incluido Excel en español): columnas correctas sin el
 * problema del separador `;`, acentos en UTF-8 y números como números (se
 * pueden sumar). Cero librerías externas → cero supply-chain y sin sumar peso
 * al bundle. Reutilizable por cualquier módulo (Blufin, Camanchaca, etc.).
 *
 * El .xlsx es un ZIP de archivos XML. Aquí se arma a mano: el contenedor ZIP
 * (método "stored", sin compresión) + las partes mínimas del paquete OOXML,
 * usando inline strings para no manejar la tabla de strings compartidos.
 */

export type XlsxCell = string | number | null | undefined;
export type XlsxSheet = { name: string; rows: XlsxCell[][] };

const enc = new TextEncoder();

function xmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;',
  );
}

// Quita caracteres de control 0x00–0x1F (salvo \t=9, \n=10, \r=13): no
// permitidos en XML 1.0. Char-code en vez de regex para no meter bytes de
// control en el código fuente.
function stripCtrl(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code > 31 || code === 9 || code === 10 || code === 13) out += s[i];
  }
  return out;
}

/** Índice de columna (0-based) → letra de Excel: 0→A, 25→Z, 26→AA. */
function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sheetXml(rows: XlsxCell[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          if (cell == null || cell === '') return '';
          const ref = colLetter(c) + (r + 1);
          if (typeof cell === 'number' && Number.isFinite(cell)) {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }
          const text = xmlEscape(stripCtrl(String(cell)));
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${body}</sheetData></worksheet>`
  );
}

/** Nombre de hoja válido: ≤31 chars, sin \ / ? * [ ] : */
function sanitizeSheetName(name: string, idx: number): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return cleaned || `Hoja${idx + 1}`;
}

// ── CRC32 (tabla precalculada) ──────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

type ZipEntry = { name: string; data: Uint8Array };

/** Empaqueta entradas en un ZIP (método stored, sin compresión). */
function zip(entries: ZipEntry[]): Uint8Array {
  const out: number[] = [];
  const central: number[] = [];
  const u16 = (a: number[], v: number) => a.push(v & 0xff, (v >>> 8) & 0xff);
  const u32 = (a: number[], v: number) =>
    a.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  const bytes = (a: number[], b: Uint8Array) => {
    for (let i = 0; i < b.length; i++) a.push(b[i]);
  };

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const offset = out.length;

    // Local file header
    u32(out, 0x04034b50);
    u16(out, 20); // versión necesaria
    u16(out, 0x0800); // flag bit 11: nombres/strings en UTF-8
    u16(out, 0); // método: stored
    u16(out, 0); // hora
    u16(out, 0x21); // fecha: 1980-01-01
    u32(out, crc);
    u32(out, e.data.length); // tamaño comprimido
    u32(out, e.data.length); // tamaño sin comprimir
    u16(out, nameBytes.length);
    u16(out, 0); // extra
    bytes(out, nameBytes);
    bytes(out, e.data);

    // Central directory header
    u32(central, 0x02014b50);
    u16(central, 20); // versión creada por
    u16(central, 20); // versión necesaria
    u16(central, 0x0800);
    u16(central, 0);
    u16(central, 0);
    u16(central, 0x21);
    u32(central, crc);
    u32(central, e.data.length);
    u32(central, e.data.length);
    u16(central, nameBytes.length);
    u16(central, 0); // extra
    u16(central, 0); // comentario
    u16(central, 0); // disco
    u16(central, 0); // attrs internos
    u32(central, 0); // attrs externos
    u32(central, offset);
    bytes(central, nameBytes);
  }

  const cdOffset = out.length;
  bytes(out, new Uint8Array(central));

  // End of central directory
  u32(out, 0x06054b50);
  u16(out, 0);
  u16(out, 0);
  u16(out, entries.length);
  u16(out, entries.length);
  u32(out, central.length);
  u32(out, cdOffset);
  u16(out, 0);

  return new Uint8Array(out);
}

/** Arma los bytes de un .xlsx con una o más hojas. Función pura (testeable). */
export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const names = sheets.map((s, i) => sanitizeSheetName(s.name, i));

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    names.map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    `</sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    `</Relationships>`;

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRels) },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc.encode(sheetXml(s.rows)),
    })),
  ];

  return zip(entries);
}

/** Genera el .xlsx y dispara la descarga en el navegador. */
export function downloadXlsx(filename: string, sheets: XlsxSheet[]): void {
  const bytes = buildXlsx(sheets);
  // Copia a un ArrayBuffer "puro" para el Blob: TS tipa Uint8Array como
  // Uint8Array<ArrayBufferLike> y no lo acepta directo como BlobPart.
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
