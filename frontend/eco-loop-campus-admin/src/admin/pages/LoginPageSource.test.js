const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const source = readFileSync(join(__dirname, 'LoginPage.js'), 'utf8');

test('LoginPage keeps admin credentials empty and removes backend explanation copy', () => {
  expect(source).not.toMatch(/admin@school\.edu\.vn/);
  expect(source).not.toMatch(/admin-demo/);
  expect(source).not.toMatch(/Dùng tài khoản backend PostgreSQL/);
  expect(source).not.toMatch(/Tài khoản phải có vai trò admin/);
});
