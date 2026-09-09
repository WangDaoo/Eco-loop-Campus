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
