import React from "react";
import { render, screen } from "@testing-library/react";
import ChartPanel from "./ChartPanel";

jest.mock("react-chartjs-2", () => ({
  Line: ({ data, options }) => <div data-testid="line-chart" data-data={JSON.stringify(data)} data-options={JSON.stringify(options)} />,
  Bar: ({ data }) => <div data-testid="bar-chart" data-data={JSON.stringify(data)} />,
  Doughnut: ({ data }) => <div data-testid="doughnut-chart" data-data={JSON.stringify(data)} />,
}));

test("ChartPanel passes safe default data and options when props are missing", () => {
  render(<ChartPanel title="Bieu do" />);

  const chart = screen.getByTestId("line-chart");
  expect(chart).toHaveAttribute("data-data", JSON.stringify({ labels: [], datasets: [] }));
  expect(chart).toHaveAttribute("data-options", JSON.stringify({ responsive: true, maintainAspectRatio: false }));
});