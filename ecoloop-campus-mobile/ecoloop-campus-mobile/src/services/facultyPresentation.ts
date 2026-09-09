import { Faculty, UserProfile } from '../types';

const DEFAULT_FACULTY_LABELS: Record<string, string> = {
  'information-technology': 'Khoa Công nghệ thông tin',
  'mechanical-engineering': 'Khoa Cơ khí',
  'electrical-electronics': 'Khoa Điện - Điện tử',
  'chemical-environmental': 'Khoa Công nghệ Hóa học và Môi trường',
  economics: 'Khoa Kinh tế',
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isBrokenVietnamese(value: string) {
  return /[?�]/.test(value) || /Ã|Â|Ä|áº|á»|Æ/.test(value);
}

export function resolveFacultyDisplayName(user: Pick<UserProfile, 'facultyCode' | 'facultyName' | 'group' | 'role'>, faculties: Faculty[] = []) {
  const facultyCode = clean(user.facultyCode);
  const catalogName = clean(faculties.find(item => item.code === facultyCode && item.status !== 'inactive')?.name);
  const facultyName = clean(user.facultyName);
  const group = clean(user.group);

  if (catalogName && !isBrokenVietnamese(catalogName)) return catalogName;
  if (facultyName && !isBrokenVietnamese(facultyName)) return facultyName;
  if (facultyCode && DEFAULT_FACULTY_LABELS[facultyCode]) return DEFAULT_FACULTY_LABELS[facultyCode];
  if (group && !isBrokenVietnamese(group)) return group;
  if (user.role === 'volunteer') return 'Tình nguyện viên';
  return 'Sinh viên';
}
