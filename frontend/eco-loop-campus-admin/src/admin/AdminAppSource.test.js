const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const source = readFileSync(join(__dirname, 'AdminApp.js'), 'utf8');

test('AdminApp exposes avatar preset management in the protected admin shell', () => {
  expect(source).toMatch(/AvatarPresetsPage/);
  expect(source).toMatch(/path: "\/avatars"/);
  expect(source).toMatch(/label: "Avatar"/);
});
