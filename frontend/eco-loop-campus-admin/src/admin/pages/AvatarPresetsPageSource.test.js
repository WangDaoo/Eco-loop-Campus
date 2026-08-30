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

test('AvatarPresetsPage lets admins replace an existing avatar image without restoring old fields', () => {
  expect(source).toMatch(/editingKey/);
  expect(source).toMatch(/openEditForm/);
  expect(source).toMatch(/Sửa ảnh/);
  expect(source).toMatch(/Chọn ảnh mới trước khi lưu/);
  expect(source).toMatch(/disabled=\{Boolean\(editingKey\)/);
  expect(source).not.toMatch(/URL ảnh/);
  expect(source).not.toMatch(/Thứ tự/);
  expect(source).not.toMatch(/Trạng thái/);
  expect(source).not.toMatch(/Màu nền|Màu khung|Màu nhấn|Màu nét mặt/);
});

test('AvatarPresetsPage lets admins delete an avatar preset from the backend', () => {
  expect(source).toMatch(/deleteAvatarPreset/);
  expect(source).toMatch(/Xoá/);
  expect(source).toMatch(/window\.confirm/);
  expect(source).toMatch(/Đã xoá avatar/);
});
