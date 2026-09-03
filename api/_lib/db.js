import { createClient } from "@supabase/supabase-js";

let client;

// Service-role client for serverless functions only — never ship this key
// to the browser. Reuses VITE_SUPABASE_URL (already set for the frontend
// build) so there's only one URL to configure; the service role key is
// separate (SUPABASE_SERVICE_ROLE_KEY) since the anon key can't bypass RLS
// to look up an arbitrary recipient's email.
export function getAdminClient() {
  if (client) return client;
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return client;
}
