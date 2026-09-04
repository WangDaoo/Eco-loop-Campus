const { readFileSync } = require('fs');
const { join } = require('path');

const source = readFileSync(join(__dirname, 'BinsPage.js'), 'utf8');

test('BinsPage subscribes to realtime bin changes after initial load', () => {
  expect(source).toMatch(/subscribeBins/);
  expect(source).toMatch(/setBins\(current => applyBinRealtimeChange\(current, payload\)\)/);
  expect(source).toMatch(/return unsubscribe/);
});

test('BinsPage uses generated Eco-loop station codes instead of free-form identifiers', () => {
  expect(source).toMatch(/buildStationQrCode/);
  expect(source).toMatch(/buildStationQrPayload/);
  expect(source).toMatch(/buildNextStationId/);
  expect(source).toMatch(/Mã thùng tự sinh/);
  expect(source).toMatch(/Mã QR tự sinh/);
  expect(source).toMatch(/campusTopo/);
  expect(source).not.toMatch(/<label>Mã QR<input/);
  expect(source).not.toMatch(/`QR-\$\{id\}`/);
});

test('BinsPage QR modal uses specific QR classes so station code text is not drawn as a fake QR block', () => {
  expect(source).toMatch(/className="eg-qr-preview"/);
  expect(source).toMatch(/className="eg-qr-code-text"/);
  expect(source).not.toMatch(/<div>\{selectedQr\.qrCode\}<\/div>/);
});
