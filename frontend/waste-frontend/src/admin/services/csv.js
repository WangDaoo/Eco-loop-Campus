export function buildCsvContent(rows) {
  const rowList = Array.isArray(rows) ? rows : [];
  const safeRows = rowList.length ? rowList : [{ empty: "Không có dữ liệu" }];
  const headers = Object.keys(safeRows[0]);
  const escapeCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...safeRows.map(row => headers.map(header => escapeCell(row[header])).join(","))].join("\n");
}

export function downloadCsv(filename, rows) {
  const csv = buildCsvContent(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
