import { buildCsvContent } from "./csv";

test("escapes commas quotes newlines and empty values in csv cells", () => {
  const csv = buildCsvContent([
    { ten: "Nhựa, PET", ghiChu: "Có \"chai\"\n2 cái", diem: null },
  ]);

  expect(csv).toBe('ten,ghiChu,diem\n"Nhựa, PET","Có ""chai""\n2 cái",""');
});

test("builds a Vietnamese empty-data csv fallback", () => {
  expect(buildCsvContent([])).toBe('empty\n"Không có dữ liệu"');
});
test("treats missing rows as empty data", () => {
  expect(buildCsvContent()).toBe('empty\n"Không có dữ liệu"');
});
