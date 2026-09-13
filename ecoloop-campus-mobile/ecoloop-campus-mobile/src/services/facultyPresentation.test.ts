import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFacultyDisplayName } from './facultyPresentation';

test('faculty display prefers a clean catalog name over broken profile text', () => {
  const label = resolveFacultyDisplayName(
    {
      role: 'student',
      facultyCode: 'information-technology',
      facultyName: 'Khoa C?ng ngh? th?ng tin',
      group: 'Khoa C?ng ngh? th?ng tin',
    },
    [{ code: 'information-technology', name: 'Khoa Công nghệ thông tin', status: 'active', sortOrder: 1 }]
  );

  assert.equal(label, 'Khoa Công nghệ thông tin');
});

test('faculty display falls back to known code when backend text is mojibake', () => {
  const label = resolveFacultyDisplayName({
    role: 'student',
    facultyCode: 'information-technology',
    group: 'Khoa C?ng ngh? th?ng tin',
  });

  assert.equal(label, 'Khoa Công nghệ thông tin');
});

test('faculty display covers every HYUTE public faculty code when backend text is mojibake', () => {
  const cases = [
    ['mechanical-engineering', 'Khoa Cơ khí'],
    ['automotive-engineering', 'Khoa Cơ khí Động lực'],
    ['electrical-electronics', 'Khoa Điện - Điện tử'],
    ['information-technology', 'Khoa Công nghệ thông tin'],
    ['garment-fashion', 'Khoa Công nghệ May và Thời trang'],
    ['chemical-environmental', 'Khoa Công nghệ Hóa học và Môi trường'],
    ['economics', 'Khoa Kinh tế'],
    ['foreign-languages', 'Khoa Ngoại ngữ'],
    ['technical-education', 'Khoa Sư phạm Kỹ thuật'],
    ['basic-sciences', 'Khoa Khoa học cơ bản'],
    ['political-theory', 'Khoa Lý luận chính trị'],
  ] as const;

  for (const [facultyCode, expected] of cases) {
    assert.equal(
      resolveFacultyDisplayName({
        role: 'student',
        facultyCode,
        facultyName: 'Khoa C?ng ngh?',
        group: 'Khoa C?ng ngh?',
      }),
      expected
    );
  }
});
