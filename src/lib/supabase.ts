import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client, authenticated with the service_role key (bypasses
 * RLS). Import this ONLY from server code (API route handlers) - the
 * service_role key must never reach a client bundle. The `notes` table has RLS
 * enabled with zero policies, so this is the only key that can read/write it.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
