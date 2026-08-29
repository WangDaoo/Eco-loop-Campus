type SyncSource = 'backend';
type SyncTone = 'success' | 'warning';

export type SyncStatusCopy = {
  title: string;
  detail: string;
  tone: SyncTone;
};

export function getSyncStatusCopy(syncSource: SyncSource, syncError: string): SyncStatusCopy {
  if (syncError.trim()) {
    return {
      title: 'Cần đồng bộ dữ liệu',
      detail: syncError.trim(),
      tone: 'warning'
    };
  }

  return {
    title: 'Đang đồng bộ',
    detail: 'Dữ liệu đang đồng bộ từ backend PostgreSQL.',
    tone: 'success'
  };
}
