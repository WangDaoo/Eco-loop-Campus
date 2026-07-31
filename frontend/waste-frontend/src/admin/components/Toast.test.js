import React from "react";
import { render, screen } from "@testing-library/react";
import Toast from "./Toast";

test("Toast normalizes dirty tone values", () => {
  render(<Toast message="Có lỗi" tone=" DANGER " />);

  const toast = screen.getByRole("status");
  expect(toast).toHaveClass("eg-toast");
  expect(toast).toHaveClass("tone-danger");
  expect(toast).not.toHaveClass("tone-");
});
