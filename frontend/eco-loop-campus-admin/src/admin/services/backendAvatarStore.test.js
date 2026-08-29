import {
  buildBackendAssetUrl,
  listAvatarPresets,
  saveAvatarPreset,
} from "./backendAvatarStore";

describe("backendAvatarStore", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("lists avatar presets from the backend API", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { key: "mam-xanh", label: "Mầm xanh", imageUrl: "/uploads/avatars/mam-xanh/avatar.png" },
      ],
    });

    const response = await listAvatarPresets();

    expect(global.fetch).toHaveBeenCalledWith("http://127.0.0.1:8000/api/avatar-presets");
    expect(response).toEqual({
      data: [
        {
          key: "mam-xanh",
          label: "Mầm xanh",
          imageUrl: "http://127.0.0.1:8000/uploads/avatars/mam-xanh/avatar.png",
          createdAt: "",
          updatedAt: "",
        },
      ],
      source: "backend",
      error: null,
    });
  });

  test("uploads key, label, and image in one backend request", async () => {
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: "mam-xanh", label: "Mầm xanh", imageUrl: "/uploads/avatars/mam-xanh/avatar.png" }),
    });

    const response = await saveAvatarPreset({ key: "mam-xanh", label: "Mầm xanh", file });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/avatar-presets",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
    const formData = global.fetch.mock.calls[0][1].body;
    expect(formData.get("key")).toBe("mam-xanh");
    expect(formData.get("label")).toBe("Mầm xanh");
    expect(formData.get("file")).toBe(file);
    expect(response.data.imageUrl).toBe("http://127.0.0.1:8000/uploads/avatars/mam-xanh/avatar.png");
  });

  test("returns backend errors without Supabase wording", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "DATABASE_URL chưa cấu hình" }),
    });

    const response = await saveAvatarPreset({ key: "mam-xanh", label: "Mầm xanh", file: new File(["x"], "x.png") });

    expect(response.data).toBeNull();
    expect(response.error.message).toBe("DATABASE_URL chưa cấu hình");
    expect(response.error.message).not.toMatch(/Supabase|Storage|RLS/);
  });

  test("buildBackendAssetUrl leaves absolute image URLs unchanged", () => {
    expect(buildBackendAssetUrl("https://cdn.example/avatar.png")).toBe("https://cdn.example/avatar.png");
    expect(buildBackendAssetUrl("")).toBe("");
  });
});
