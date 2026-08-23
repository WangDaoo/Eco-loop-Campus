import { AvatarPreset } from '../types';

export const DEFAULT_AVATAR_PRESETS: AvatarPreset[] = [
  { key: 'sprout', label: 'Mầm xanh', background: '#cbf9e4', tile: '#a8f2ab', accent: '#8bc34a', face: '#2c6e6e', status: 'active', sortOrder: 1 },
  { key: 'sunny', label: 'Nắng xanh', background: '#fff1a8', tile: '#c8f4a6', accent: '#f0b84f', face: '#2c6e6e', status: 'active', sortOrder: 2 },
  { key: 'wave', label: 'Biển sạch', background: '#bcefff', tile: '#91e0f2', accent: '#38a3c7', face: '#256a7a', status: 'active', sortOrder: 3 },
  { key: 'berry', label: 'Hoa campus', background: '#f7c4df', tile: '#d5f6b8', accent: '#d8669f', face: '#2c6e6e', status: 'active', sortOrder: 4 },
];

export function visibleAvatarPresets(options: AvatarPreset[] | undefined) {
  const safeOptions = Array.isArray(options) ? options : [];
  const activeOptions = safeOptions.filter(option => option.status === 'active' && option.key && option.label);
  return (activeOptions.length ? activeOptions : DEFAULT_AVATAR_PRESETS).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'vi-VN'));
}
