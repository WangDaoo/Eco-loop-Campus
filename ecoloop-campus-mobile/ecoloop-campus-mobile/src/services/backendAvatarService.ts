import { AvatarPreset } from '../types';

type Row = Record<string, unknown>;

type FetchResponseLike = {
  ok?: boolean;
  status?: number;
  json(): Promise<unknown>;
};

type FetchLike = (url: string) => Promise<FetchResponseLike>;

const DEFAULT_API_URL = 'http://10.0.2.2:8000';

function normalizedBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

async function readError(response: FetchResponseLike) {
  try {
    const payload = await response.json() as Row;
    return text(payload.detail || payload.error || payload.message, `Backend avatar chưa sẵn sàng${response.status ? ` (${response.status})` : ''}`);
  } catch {
    return `Backend avatar chưa sẵn sàng${response.status ? ` (${response.status})` : ''}`;
  }
}

export function buildBackendAssetUrl(url: unknown, baseUrl: string) {
  const value = text(url).trim();
  if (!value) return undefined;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const root = normalizedBaseUrl(baseUrl);
  return value.startsWith('/') ? `${root}${value}` : `${root}/${value}`;
}

export function normalizeBackendAvatarPreset(row: Row, baseUrl: string): AvatarPreset {
  return {
    key: text(row.key || row.id).trim(),
    label: text(row.label, 'Avatar Eco-loop').trim(),
    imageUrl: buildBackendAssetUrl(row.imageUrl || row.image_url, baseUrl),
    background: '#ffffff',
    tile: '#ffffff',
    accent: '#2c6e6e',
    face: '#2c6e6e',
    status: text(row.status, 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active',
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0) || 0,
  };
}

export function createBackendAvatarService({
  baseUrl = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL,
  fetcher = fetch as unknown as FetchLike,
}: { baseUrl?: string; fetcher?: FetchLike } = {}) {
  const endpointBaseUrl = normalizedBaseUrl(baseUrl);

  return {
    async listAvatarPresets(): Promise<AvatarPreset[]> {
      const response = await fetcher(`${endpointBaseUrl}/api/avatar-presets`);
      if (!response.ok) throw new Error(await readError(response));
      const payload = await response.json();
      if (!Array.isArray(payload)) return [];
      return payload
        .map(row => normalizeBackendAvatarPreset(row as Row, endpointBaseUrl))
        .filter(option => option.status === 'active' && option.key && option.label)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'vi-VN'));
    },
  };
}
