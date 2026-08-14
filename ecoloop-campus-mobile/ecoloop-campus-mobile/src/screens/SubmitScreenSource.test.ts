import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'SubmitScreen.tsx'), 'utf8');
const mojibakePattern = /QuÃ|Tráº|ChÆ|Ä‘|Ã¡|Ã©|Ã´|Ãª|áº|á»/;

test('SubmitScreen saves AI prediction results after FastAPI returns a class', () => {
  assert.match(source, /saveAiPrediction/);
  assert.match(source, /predictionId/);
  assert.match(source, /Đã lưu AI/);
});

test('SubmitScreen keeps QR submission flow and readable Vietnamese copy', () => {
  assert.doesNotMatch(source, mojibakePattern);
  assert.match(source, /Tạo mã QR giao dịch dùng một lần/);
  assert.match(source, /Phân loại AI/);
  assert.match(source, /buildSubmitAiSuggestion/);
  assert.match(source, /AI đã nhận diện/);
  assert.match(source, /Chạy trên thiết bị/);
});
