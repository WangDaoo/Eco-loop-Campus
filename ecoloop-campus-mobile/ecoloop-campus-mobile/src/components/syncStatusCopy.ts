type SyncSource = 'mock' | 'supabase';
type SyncTone = 'success' | 'neutral' | 'warning';

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

  if (syncSource === 'supabase') {
    return {
      title: 'Đang đồng bộ',
      detail: 'Dữ liệu đang đồng bộ trực tiếp.',
      tone: 'success'
    };
  }

  return {
    title: 'Dữ liệu trên thiết bị',
    detail: 'Một số nội dung đang được lưu tạm trên máy.',
    tone: 'neutral'
  };
}
