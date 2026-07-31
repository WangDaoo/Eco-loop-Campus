import React from "react";
import { render, screen } from "@testing-library/react";
import DataTable from "./DataTable";

test("DataTable renders the empty state when rows are missing", () => {
  render(<DataTable columns={[{ key: "name", label: "Tên" }]} emptyText="Chưa có dữ liệu" />);

  expect(screen.getByRole("columnheader", { name: "Tên" })).toBeInTheDocument();
  expect(screen.getByText("Chưa có dữ liệu")).toBeInTheDocument();
});
test("DataTable renders malformed object and array cell values safely", () => {
  render(
    <DataTable
      columns={[
        { key: "meta", label: "Meta" },
        { key: "tags", label: "Tags" },
        { key: "missing", label: "Missing" },
      ]}
      rows={[{ id: "bad-row", meta: { name: "PET" }, tags: ["plastic", "clean"] }]}
    />
  );

  expect(screen.getByText('{"name":"PET"}')).toBeInTheDocument();
  expect(screen.getByText("plastic, clean")).toBeInTheDocument();
  expect(screen.getByText("-")).toBeInTheDocument();
});
