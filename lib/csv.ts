export function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
