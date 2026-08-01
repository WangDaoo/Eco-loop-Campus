import { getBinGroup, getGroupColor, getWasteLabel, normalizePrediction } from "./wasteConfig";

test("maps all AI classes into the expected school bin groups", () => {
  expect(getBinGroup("biological")).toBe("Hữu cơ");
  expect(getBinGroup("paper")).toBe("Tái chế");
  expect(getBinGroup("cardboard")).toBe("Tái chế");
  expect(getBinGroup("plastic")).toBe("Tái chế");
  expect(getBinGroup("glass")).toBe("Tái chế");
  expect(getBinGroup("metal")).toBe("Tái chế");
  expect(getBinGroup("battery")).toBe("Pin / nguy hại");
  expect(getBinGroup("clothes")).toBe("Còn lại");
  expect(getBinGroup("shoes")).toBe("Còn lại");
  expect(getBinGroup("trash")).toBe("Còn lại");
});

test("falls back safely for unknown waste classes", () => {
  expect(getWasteLabel("unknown-waste")).toBe("unknown-waste");
  expect(getBinGroup("unknown-waste")).toBe("Còn lại");
});

test("normalizes dirty waste class keys before mapping labels and bin groups", () => {
  expect(getWasteLabel(" Plastic ")).toBe("Nhựa");
  expect(getBinGroup(" PAPER ")).toBe("Tái chế");
  expect(getBinGroup(" Battery ")).toBe("Pin / nguy hại");
});

test("normalizes dirty bin group labels before choosing group colors", () => {
  expect(getGroupColor(" Tái chế ")).toBe("#4680ff");
  expect(getGroupColor(" hữu cơ ")).toBe("#2ca87f");
  expect(getGroupColor(" PIN / NGUY HẠI ")).toBe("#e58a00");
});

test("normalizes predictions and clamps invalid confidence values", () => {
  expect(normalizePrediction({ class: "plastic", confidence: -0.4 }).confidence).toBe(0);
  expect(normalizePrediction({ class: "plastic", confidence: 1.8 }).confidence).toBe(1);
  expect(normalizePrediction({ class: "plastic", confidence: "bad" }).confidence).toBe(0);
  expect(normalizePrediction({ class: "plastic", confidence: 0.73 }).confidence).toBe(0.73);
});

test("normalizes prediction image URLs for review previews", () => {
  const prediction = normalizePrediction({
    class: "plastic",
    confidence: 0.73,
    imageUrl: "https://storage.example/full.jpg",
    thumbnailUrl: "https://storage.example/thumb.jpg",
  });

  expect(prediction.imageUrl).toBe("https://storage.example/full.jpg");
  expect(prediction.thumbnailUrl).toBe("https://storage.example/thumb.jpg");
});

test("normalizes non-string prediction classes to the safe fallback class", () => {
  expect(() => normalizePrediction({ class: 123, confidence: 0.7 })).not.toThrow();
  expect(normalizePrediction({ class: 123, confidence: 0.7 }).class).toBe("trash");
  expect(normalizePrediction({ className: { value: "paper" }, confidence: 0.7 }).class).toBe("trash");
});
