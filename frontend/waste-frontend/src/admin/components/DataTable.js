import React from "react";

function formatCellValue(value) {
  if (React.isValidElement(value)) return value;
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.map(item => formatCellValue(item)).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return value;
}

export default function DataTable({ columns, rows, emptyText = "Không có dữ liệu" }) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <div className="eg-table-wrap">
      <table className="eg-table">
        <thead>
          <tr>
            {safeColumns.map(column => (
              <th key={column.key} scope="col">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeRows.length ? safeRows.map((row, rowIndex) => (
            <tr key={row.id || rowIndex}>
              {safeColumns.map(column => (
                <td key={column.key}>{column.render ? column.render(row) : formatCellValue(row[column.key])}</td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={Math.max(safeColumns.length, 1)} className="eg-empty-cell">{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
