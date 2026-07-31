import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Modal from "./Modal";

test("Modal closes when Escape is pressed", () => {
  const onClose = jest.fn();

  render(
    <Modal open title="Sửa dữ liệu" onClose={onClose}>
      <button type="button">Nút trong modal</button>
    </Modal>
  );

  expect(screen.getByRole("dialog", { name: "Sửa dữ liệu" })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });

  expect(onClose).toHaveBeenCalledTimes(1);
});
