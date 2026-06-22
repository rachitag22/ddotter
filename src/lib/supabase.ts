import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null = null;

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && getSupabaseServerKey());
}

function getSupabaseServerKey() {
  return (
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseServerClient() {
  const key = getSupabaseServerKey();

  if (!process.env.SUPABASE_URL || !key) {
    throw new Error("Supabase server environment is not configured.");
  }

  if (!serverClient) {
    serverClient = createClient(process.env.SUPABASE_URL, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverClient;
}

let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!browserClient) {
    browserClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return browserClient;
}

export function getSupabaseSyncClient() {
  const key = getSupabaseServerKey();

  if (!process.env.SUPABASE_URL || !key) {
    throw new Error("Supabase server environment is not configured.");
  }

  return createClient(process.env.SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: process.env.SYNC_SECRET ? { "x-sync-secret": process.env.SYNC_SECRET } : {},
    },
  });
}
