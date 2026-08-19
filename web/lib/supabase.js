import { createClient } from "@supabase/supabase-js";

let client;

export function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ontbreken.");
    }
    client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export const FILES_BUCKET = "client-files";
