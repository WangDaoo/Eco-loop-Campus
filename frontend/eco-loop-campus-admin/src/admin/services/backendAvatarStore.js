const BACKEND = "backend";
const DEFAULT_API_URL = "http://127.0.0.1:8000";
const TOKEN_KEY = "ecoloop_admin_token";
const API_URL = (process.env.REACT_APP_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");

function result(data, error = null) {
  return { data, source: BACKEND, error };
}

function errorFromMessage(message) {
  return new Error(message || "Backend avatar chưa kết nối");
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readError(response) {
  try {
    const payload = await response.json();
    return payload?.detail || payload?.error || payload?.message || response.statusText;
  } catch {
    return response.statusText || "Backend avatar chưa kết nối";
  }
}

export function buildBackendAssetUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return value.startsWith("/") ? `${API_URL}${value}` : `${API_URL}/${value}`;
}

function normalizeAvatarPreset(row = {}) {
  return {
    key: String(row.key || "").trim(),
    label: String(row.label || "").trim(),
    imageUrl: buildBackendAssetUrl(row.imageUrl || row.image_url || ""),
    createdAt: row.createdAt || row.created_at || "",
    updatedAt: row.updatedAt || row.updated_at || "",
  };
}

export async function listAvatarPresets() {
  try {
    const response = await fetch(`${API_URL}/api/avatar-presets`, { headers: authHeaders() });
    if (!response.ok) throw errorFromMessage(await readError(response));
    const payload = await response.json();
    const data = Array.isArray(payload) ? payload.map(normalizeAvatarPreset) : [];
    return result(data);
  } catch (error) {
    return result([], errorFromMessage(error.message));
  }
}

export async function saveAvatarPreset({ key, label, file }) {
  if (!key?.trim() || !label?.trim() || !file) {
    return result(null, errorFromMessage("Thiếu mã avatar, tên avatar hoặc ảnh"));
  }

  try {
    const formData = new FormData();
    formData.append("key", key.trim());
    formData.append("label", label.trim());
    formData.append("file", file);

    const response = await fetch(`${API_URL}/api/avatar-presets`, {
      method: "POST",
      body: formData,
      headers: authHeaders(),
    });
    if (!response.ok) throw errorFromMessage(await readError(response));
    return result(normalizeAvatarPreset(await response.json()));
  } catch (error) {
    return result(null, errorFromMessage(error.message));
  }
}

export async function deleteAvatarPreset(key) {
  if (!key?.trim()) return result(null, errorFromMessage("Thiếu mã avatar"));
  try {
    const response = await fetch(`${API_URL}/api/avatar-presets/${encodeURIComponent(key.trim())}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!response.ok) throw errorFromMessage(await readError(response));
    return result({ ok: true });
  } catch (error) {
    return result(null, errorFromMessage(error.message));
  }
}
