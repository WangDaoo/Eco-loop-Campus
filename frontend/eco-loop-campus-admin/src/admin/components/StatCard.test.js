import React from "react";
import { render, screen } from "@testing-library/react";
import StatCard from "./StatCard";

test("StatCard normalizes dirty tone and ignores invalid icon", () => {
  render(<StatCard title="Tong scan" value="123" hint="Hom nay" tone=" GREEN " icon={{ bad: true }} />);

  const card = screen.getByText("123").closest("article");
  expect(card).toHaveClass("eg-stat-card");
  expect(card).toHaveClass("tone-green");
  expect(card).not.toHaveClass("tone- GREEN ");
  expect(screen.getByText("Tong scan")).toBeInTheDocument();
});