import React from "react";
import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";

test("StatusBadge normalizes dirty status values", () => {
  render(<StatusBadge status=" APPROVED " />);

  const badge = screen.getByText("Đã duyệt");
  expect(badge).toHaveClass("eg-badge");
  expect(badge).toHaveClass("is-approved");
  expect(badge).not.toHaveTextContent("APPROVED");
});
