import { createBrowserClient } from "@supabase/ssr";

// Browser client with the admin's session cookie; used for direct uploads to Storage.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
