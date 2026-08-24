import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv } from "./env";

let browserClient: SupabaseClient | undefined;

export function createClient() {
  if (browserClient) return browserClient;
  const { url, anonKey } = requirePublicSupabaseEnv();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
