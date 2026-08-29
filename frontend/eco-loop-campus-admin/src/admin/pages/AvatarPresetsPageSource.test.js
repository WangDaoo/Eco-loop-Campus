const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const source = readFileSync(join(__dirname, 'AvatarPresetsPage.js'), 'utf8');

test('AvatarPresetsPage lets admins manage server-provided avatar presets', () => {
  expect(source).toMatch(/backendAvatarStore/);
  expect(source).toMatch(/listAvatarPresets/);
  expect(source).toMatch(/saveAvatarPreset/);
  expect(source).not.toMatch(/uploadAvatarPresetImage/);
  expect(source).toMatch(/type="file"/);
  expect(source).toMatch(/Admin upload ảnh và đặt tên ảnh/);
  expect(source).not.toMatch(/Supabase/);
});

test('AvatarPresetsPage keeps avatar management to code, name, and image upload only', () => {
  expect(source).toMatch(/Mã avatar/);
  expect(source).toMatch(/Tên avatar/);
  expect(source).toMatch(/Upload ảnh/);
  expect(source).not.toMatch(/URL ảnh/);
  expect(source).not.toMatch(/Thứ tự/);
  expect(source).not.toMatch(/Trạng thái/);
  expect(source).not.toMatch(/Màu nền|Màu khung|Màu nhấn|Màu nét mặt/);
  expect(source).not.toMatch(/sortOrder/);
  expect(source).not.toMatch(/row\.background|row\.tile|row\.accent|row\.face/);
  expect(source).not.toMatch(/--avatar-bg|--avatar-tile|--avatar-accent|--avatar-face/);
});

test('AvatarPresetsPage removes the old inline edit workflow from the avatar list', () => {
  expect(source).not.toMatch(/editPreset/);
  expect(source).not.toMatch(/Thao tác/);
  expect(source).not.toMatch(/Sửa avatar/);
  expect(source).not.toMatch(/>Sửa</);
});
