import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;
let serviceClient: SupabaseClient | undefined;

export function getSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for the local demo database API");
  }

  client ??= createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export function getSupabaseServiceClient() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The local demo database API cannot use service-role credentials in production");
  }

  const url = process.env.VITE_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error("VITE_SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY are required for atomic demo transactions");
  }

  serviceClient ??= createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return serviceClient;
}
