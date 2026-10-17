import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Acts as the logged-in user, so RLS applies.
export async function createClient() {
  // The auth client reads the current time. That has to happen on the request, not while prerendering.
  await connection();
  const store = await cookies();
  return createServerClient(url(), publishableKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // ponytail: Server Components cannot set cookies; the proxy already refreshes the session
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {}
      },
    },
  });
}

// Bypasses RLS. Only call after requireAdmin(), or for the fixed, validated insert in /api/track.
export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY missing in .env.local");
  return createSupabaseClient(url(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
