type CsvCell = string | number;

/** Quote every cell so commas, quotes, and line breaks round-trip safely. */
export function serializeCsv(rows: readonly (readonly CsvCell[])[]): string {
  return rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
}

export function downloadCsv(
  filename: string,
  rows: readonly (readonly CsvCell[])[],
): void {
  const url = URL.createObjectURL(
    new Blob(["\ufeff", serializeCsv(rows)], {
      type: "text/csv;charset=utf-8;",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Allow the browser to start consuming the Blob before releasing its URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
