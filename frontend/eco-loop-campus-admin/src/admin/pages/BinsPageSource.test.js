const { readFileSync } = require('fs');
const { join } = require('path');

const source = readFileSync(join(__dirname, 'BinsPage.js'), 'utf8');

test('BinsPage subscribes to realtime bin changes after initial load', () => {
  expect(source).toMatch(/subscribeBins/);
  expect(source).toMatch(/setBins\(current => applyBinRealtimeChange\(current, payload\)\)/);
  expect(source).toMatch(/return unsubscribe/);
});
