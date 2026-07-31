import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";

test("Sidebar renders safely when items are missing", () => {
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

  expect(screen.getByText("Eco-loop Campus")).toBeInTheDocument();
  expect(screen.queryByText("EcoGuardian")).not.toBeInTheDocument();
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});
test("Sidebar renders links safely when an item icon is missing", () => {
  render(
    <MemoryRouter>
      <Sidebar items={[{ path: "/dashboard", label: "Tong quan" }]} />
    </MemoryRouter>
  );

  expect(screen.getByRole("link", { name: /tong quan/i })).toHaveAttribute("href", "/dashboard");
});
