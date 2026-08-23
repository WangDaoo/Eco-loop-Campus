const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const source = readFileSync(join(__dirname, 'AvatarPresetsPage.js'), 'utf8');

test('AvatarPresetsPage lets admins manage server-provided avatar presets', () => {
  expect(source).toMatch(/listAvatarPresets/);
  expect(source).toMatch(/saveAvatarPreset/);
  expect(source).toMatch(/uploadAvatarPresetImage/);
  expect(source).toMatch(/type="file"/);
  expect(source).toMatch(/avatar-presets/);
  expect(source).toMatch(/Sinh viên sẽ chọn trong danh mục avatar đang hoạt động/);
});
