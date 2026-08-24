import { createClient } from "@supabase/supabase-js";
import { requireServiceRoleEnv } from "./env";

export function createAdminClient() {
  const { url, serviceRoleKey } = requireServiceRoleEnv();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
