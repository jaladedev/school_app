const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function escapeCsvField(value: string): string {
  // Check the first non-whitespace character, not just value[0] — a
  // leading space before a formula trigger (" =SUM(...)") would
  // otherwise slip past the guard while some spreadsheet apps still
  // evaluate it as a formula on paste/import.
  const firstMeaningfulChar = value.trimStart()[0] ?? "";
  const needsFormulaGuard = FORMULA_TRIGGER_CHARS.has(firstMeaningfulChar);
  const safeValue = needsFormulaGuard ? `'${value}` : value;

  if (safeValue.includes(",") || safeValue.includes('"') || safeValue.includes("\n")) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [
    headers.map((h) => escapeCsvField(String(h))).join(","),
    ...rows.map((row) => row.map((field) => escapeCsvField(String(field))).join(",")),
  ];
  return lines.join("\n");
}

/**
 * Triggers a browser download of the given CSV content. Must be called
 * from a client component in response to a user action (e.g. a button
 * click) — browsers block programmatic downloads that aren't tied to a
 * user gesture.
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Parses raw CSV text into rows of fields, per RFC 4180: handles quoted
 * fields (so a field can contain commas or newlines), escaped quotes
 * ("" inside a quoted field), and both \n and \r\n line endings.
 *
 * Splitting each line on a raw "," silently corrupts any field that
 * itself contains a comma — including data this app's own buildCsv above
 * can produce (guardian names like "Okafor, Jr.", addresses, etc.), so
 * exporting and re-importing the same data could break. Shared here
 * rather than duplicated per bulk-import form so the two can't drift.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote's second character
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Final field/row, if the text doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((f) => f.trim().length > 0));
}