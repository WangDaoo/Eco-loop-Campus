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
      title: 'Cần kiểm tra Supabase',
      detail: syncError.trim(),
      tone: 'warning'
    };
  }

  if (syncSource === 'supabase') {
    return {
      title: 'Realtime Supabase',
      detail: 'Dữ liệu đang đồng bộ trực tiếp.',
      tone: 'success'
    };
  }

  return {
    title: 'Demo offline',
    detail: 'App đang dùng dữ liệu mẫu trên máy.',
    tone: 'neutral'
  };
}
