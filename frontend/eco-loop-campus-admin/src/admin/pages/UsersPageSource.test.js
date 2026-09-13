import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.join(__dirname, "UsersPage.js"), "utf8");

test("users page shows the same faculty-only student profile stored by mobile", () => {
  expect(source).toMatch(/studentCode/);
  expect(source).toMatch(/phoneNumber/);
  expect(source).toMatch(/Mã sinh viên/);
  expect(source).toMatch(/Số điện thoại/);
  expect(source).toMatch(/label: "Khoa"/);
  expect(source).not.toMatch(/Lớp \/ Khoa/);
  expect(source).not.toMatch(/Mã lớp|Chuyên ngành|Ngành học/);
});

test("users page handles failed role edits without dereferencing an empty response", () => {
  expect(source).toMatch(/if \(response\.error \|\| !response\.data\)/);
  expect(source).toMatch(/Không cập nhật được người dùng/);
  expect(source).not.toMatch(/user\.id === response\.data\.id \? response\.data : user/);
});
