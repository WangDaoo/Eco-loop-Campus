import { createClient } from "@supabase/supabase-js";

const testMode = process.env.NODE_ENV === "test";
const urlEnvNames = ["REACT_APP_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"];
const keyEnvNames = [
  "REACT_APP_SUPABASE_PUBLISHABLE_KEY",
  "REACT_APP_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

function firstEnvValue(names) {
  return names.map(name => String(process.env[name] || "").trim()).find(Boolean) || "";
}

function hasEnvValue(names) {
  return names.some(name => process.env[name] !== undefined);
}

const supabaseUrl = firstEnvValue(urlEnvNames) || (!hasEnvValue(urlEnvNames) && testMode ? "https://test.supabase.co" : "");
const supabaseAnonKey = firstEnvValue(keyEnvNames) || (!hasEnvValue(keyEnvNames) && testMode ? "test-anon-key" : "");

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseConfig = {
  url: supabaseUrl,
  key: supabaseAnonKey,
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
