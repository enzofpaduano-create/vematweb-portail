import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

/**
 * Server-side Supabase client.
 * Used to validate JWTs sent by the frontend portails (DG / Manager / Technicien / Commercial).
 *
 * Required env:
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_ANON_KEY=...   (the publishable/anon key — NOT the service role)
 */

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  logger.warn("SUPABASE_URL or SUPABASE_ANON_KEY not set — auth-gated routes will return 503");
}

let client: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (client) return client;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
  client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}
