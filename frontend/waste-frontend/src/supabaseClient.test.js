const ORIGINAL_ENV = process.env;

function loadSupabaseClient(env) {
  jest.resetModules();
  const createClient = jest.fn(() => ({ name: "supabase-client" }));
  process.env = { ...ORIGINAL_ENV, ...env };
  let module;
  jest.isolateModules(() => {
    jest.doMock("@supabase/supabase-js", () => ({ createClient }));
    module = require("./supabaseClient");
  });
  return { createClient, module };
}

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.dontMock("@supabase/supabase-js");
  jest.resetModules();
});

test("does not configure Supabase when env values are blank after trimming", () => {
  const { createClient, module } = loadSupabaseClient({
    REACT_APP_SUPABASE_URL: "   ",
    REACT_APP_SUPABASE_PUBLISHABLE_KEY: "   ",
    REACT_APP_SUPABASE_ANON_KEY: "",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  });

  expect(module.isSupabaseConfigured).toBe(false);
  expect(module.supabaseConfig).toEqual({ url: "", key: "" });
  expect(module.supabase).toBeNull();
  expect(createClient).not.toHaveBeenCalled();
});

test("uses NEXT_PUBLIC Supabase URL as a fallback for shared mobile/web env", () => {
  const { createClient, module } = loadSupabaseClient({
    REACT_APP_SUPABASE_URL: "",
    REACT_APP_SUPABASE_PUBLISHABLE_KEY: "",
    REACT_APP_SUPABASE_ANON_KEY: "",
    NEXT_PUBLIC_SUPABASE_URL: "https://shared.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "shared-publishable-key",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  });

  expect(module.isSupabaseConfigured).toBe(true);
  expect(module.supabaseConfig).toEqual({ url: "https://shared.supabase.co", key: "shared-publishable-key" });
});
