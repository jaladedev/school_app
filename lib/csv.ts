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
