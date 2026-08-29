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

test("Sidebar shows avatar management when the route is available", () => {
  render(
    <MemoryRouter>
      <Sidebar items={[{ path: "/users", label: "Nguoi dung" }, { path: "/avatars", label: "Avatar" }]} />
    </MemoryRouter>
  );

  expect(screen.getByRole("link", { name: /avatar/i })).toHaveAttribute("href", "/avatars");
});
