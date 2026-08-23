import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ScansPage from "./ScansPage";
import { getModelSettings, listPredictions, setPredictionStatus } from "../services/supabaseStore";

jest.mock("../services/supabaseStore", () => ({
  getModelSettings: jest.fn(),
  listPredictions: jest.fn(),
  setPredictionStatus: jest.fn(),
}));

const scanWithImage = {
  id: "scan-img",
  class: "plastic",
  confidence: 0.82,
  source: "upload",
  timestamp: "2026-08-02T08:00:00.000Z",
  binGroup: "Tái chế",
  status: "pending",
  imageName: "plastic.jpg",
  imageUrl: "https://storage.example/full/plastic.jpg",
  thumbnailUrl: "https://storage.example/thumb/plastic.jpg",
};

beforeEach(() => {
  jest.clearAllMocks();
  listPredictions.mockResolvedValue({ data: [scanWithImage], source: "supabase", error: null });
  getModelSettings.mockResolvedValue({ data: { threshold: 0.65 }, source: "supabase", error: null });
  setPredictionStatus.mockResolvedValue({ data: { ...scanWithImage, status: "approved" }, source: "supabase", error: null });
});

test("ScansPage lets admins preview the scan image before approval", async () => {
  render(
    <MemoryRouter>
      <ScansPage />
    </MemoryRouter>
  );

  const thumbnail = await screen.findByRole("img", { name: "Ảnh lượt quét scan-img" });
  expect(thumbnail).toHaveAttribute("src", scanWithImage.thumbnailUrl);

  fireEvent.click(screen.getByRole("button", { name: "Xem ảnh scan-img" }));

  expect(screen.getByRole("dialog", { name: "Xem ảnh lượt quét scan-img" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Ảnh đầy đủ scan-img" })).toHaveAttribute("src", scanWithImage.imageUrl);
  expect(screen.getByRole("button", { name: "Duyệt scan-img từ ảnh xem trước" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Từ chối scan-img từ ảnh xem trước" })).toBeInTheDocument();
});
