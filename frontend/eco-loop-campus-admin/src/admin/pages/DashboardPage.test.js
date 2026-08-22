import { __testing } from "./DashboardPage";

test("dashboard bin alert helpers ignore null bin rows", () => {
  expect(__testing.isMaintenanceBin(null)).toBe(false);
  expect(__testing.isBinAttention(null)).toBe(false);
  expect(__testing.makePriorityItems([], [null, { id: "BIN-1", name: "Thùng A1", location: "Nhà A1", status: "full", capacity: 40 }], [])).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "bin-alerts" }),
  ]));
});

