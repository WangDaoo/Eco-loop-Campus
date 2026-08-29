const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const source = readFileSync(join(__dirname, 'AvatarPresetsPage.js'), 'utf8');

test('AvatarPresetsPage lets admins manage server-provided avatar presets', () => {
  expect(source).toMatch(/listAvatarPresets/);
  expect(source).toMatch(/saveAvatarPreset/);
  expect(source).toMatch(/uploadAvatarPresetImage/);
  expect(source).toMatch(/type="file"/);
  expect(source).toMatch(/avatar-presets/);
  expect(source).toMatch(/Admin upload ảnh và đặt tên ảnh/);
});

test('AvatarPresetsPage keeps avatar management to code, name, and image upload only', () => {
  expect(source).toMatch(/Mã avatar/);
  expect(source).toMatch(/Tên avatar/);
  expect(source).toMatch(/Upload ảnh/);
  expect(source).not.toMatch(/URL ảnh/);
  expect(source).not.toMatch(/Thứ tự/);
  expect(source).not.toMatch(/Trạng thái/);
  expect(source).not.toMatch(/Màu nền|Màu khung|Màu nhấn|Màu nét mặt/);
});

test('AvatarPresetsPage removes the old inline edit workflow from the avatar list', () => {
  expect(source).not.toMatch(/editPreset/);
  expect(source).not.toMatch(/Thao tác/);
  expect(source).not.toMatch(/Sửa avatar/);
  expect(source).not.toMatch(/>Sửa</);
});
