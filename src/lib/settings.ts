import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_AUDIO_MAX_MB = 10;
export const AUDIO_MAX_MB_LIMIT = 50;

// Readable by staff only (RLS); public pages never need settings.
export async function getAudioMaxMb(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "audio").maybeSingle();
  const mb = Number((data?.value as { max_mb?: number } | null)?.max_mb);
  return Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_AUDIO_MAX_MB;
}
