import { cacheLife, cacheTag } from "next/cache";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assignNumbers } from "@/lib/numbering";
import { DEFAULT_AUDIO_SOURCE, parseAudioSource, resolveAudioSource, type AudioSource } from "@/lib/audio-source";
import { parseSiteTheme, type SiteThemeId } from "@/lib/site-theme";
import { PRAYER_CATEGORIES, PRAYER_COLUMNS, type Prayer } from "@/lib/doa";

export type TasbihStep = { arabic: string; transliteration: string; target: number };

export type AudioInfo = {
  path: string;
  url: string | null;
  version: number;
  duration: number | null;
  offline: boolean;
  reciter: string | null;
  synthetic: boolean;
  cues: AudioCue[] | null;
};

// t = second where repetition i of n starts inside the file
export type AudioCue = { t: number; label: string; i: number; n: number };

export type Recitation = {
  id: string;
  slug: string;
  kind: "standard" | "tasbih";
  show_number: boolean;
  youtube_id: string | null;
  youtube_start: number | null;
  youtube_end: number | null;
  display_number: number | null;
  title: string;
  arabic_text: string | null;
  transliteration: string | null;
  translation: string | null;
  chip_label: string | null;
  reference_text: string | null;
  tasbih_config: { steps: TasbihStep[] } | null;
  source: AudioSource;
  audio: AudioInfo | null;
};

export type Phase = {
  id: string;
  slug: string;
  number: number;
  continue_numbering: boolean;
  title: string;
  description: string | null;
  recitations: Recitation[];
};

export const RECITATION_COLUMNS =
  "id, slug, kind, show_number, audio_source, youtube_id, youtube_start, youtube_end, title, arabic_text, transliteration, translation, chip_label, reference_text, tasbih_config, audio_files(storage_path, duration_seconds, audio_version, offline_available, synthetic, cues)";

// ponytail: longer than any cached page lifetime; the player asks /api/audio-url for a fresh one if it still expires
export const SIGNED_URL_SECONDS = 60 * 60 * 24;

type RawAudio = { storage_path: string; duration_seconds: number | null; audio_version: number; offline_available: boolean; synthetic: boolean; cues: AudioCue[] | null };
type RawRecitation = Omit<Recitation, "audio" | "display_number" | "source"> & { audio_source: string | null; audio_files: RawAudio | RawAudio[] | null };
export type RawPhase = Omit<Phase, "recitations" | "number"> & { recitations: RawRecitation[] };

// Turns embedded audio_files rows into signed URLs. Storage RLS decides which files the client may sign.
// Each card uses its own source, or the site-wide choice when audio_source is null. youtube/off return no file.
export async function withAudioUrls(
  db: SupabaseClient,
  phases: RawPhase[],
  siteSource: AudioSource,
  counts?: (r: RawRecitation, p: RawPhase) => boolean,
): Promise<Phase[]> {
  const chosen = (r: RawRecitation) => resolveAudioSource(r.audio_source, siteSource);
  const audioOf = (r: RawRecitation) => {
    const source = chosen(r);
    if (source !== "mp3" && source !== "tts") return null;
    const rows = Array.isArray(r.audio_files) ? r.audio_files : r.audio_files ? [r.audio_files] : [];
    return rows.find((a) => a.synthetic === (source === "tts")) ?? null;
  };
  const paths = phases.flatMap((p) => p.recitations.map(audioOf).filter((a): a is RawAudio => !!a).map((a) => a.storage_path));

  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await db.storage.from("audio").createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  // ponytail: numbers count only what is in this list, so the public site (RLS-filtered) renumbers itself when a card is hidden
  const numbers = assignNumbers(phases, counts);
  return phases.map((p, i) => ({
    ...p,
    number: i + 1,
    recitations: p.recitations.map((raw) => {
      const r: Partial<RawRecitation> = { ...raw };
      delete r.audio_files;
      delete r.audio_source;
      const a = audioOf(raw);
      return {
        ...(r as Omit<RawRecitation, "audio_files" | "audio_source">),
        source: chosen(raw),
        display_number: numbers.get(raw) ?? null,
        audio: a
          ? {
              path: a.storage_path,
              url: urls.get(a.storage_path) ?? null,
              version: a.audio_version,
              duration: a.duration_seconds === null ? null : Number(a.duration_seconds),
              offline: a.offline_available,
              reciter: null,
              synthetic: a.synthetic,
              cues: a.cues ?? null,
            }
          : null,
      };
    }),
  }));
}

export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ponytail: anon key + RLS decides what is public; this client must never read cookies inside "use cache"
export async function getPublishedPhases(): Promise<Phase[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");

  const db = createAnonClient();
  const { data, error } = await db
    .from("phases")
    .select(`id, slug, continue_numbering, title, description, recitations(${RECITATION_COLUMNS})`)
    .order("sort_order")
    .order("sort_order", { referencedTable: "recitations" });
  if (error) throw new Error(`Supabase: ${error.message}`);
  return withAudioUrls(db, data as unknown as RawPhase[], await getAudioSource());
}

export async function getSiteTheme(): Promise<SiteThemeId> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");

  const { data } = await createAnonClient().from("app_settings").select("value").eq("key", "site_theme").maybeSingle();
  return parseSiteTheme(data?.value);
}

export async function getAudioSource(): Promise<AudioSource> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");

  const { data } = await createAnonClient().from("app_settings").select("value").eq("key", "audio_source").maybeSingle();
  return data ? parseAudioSource(data.value) : DEFAULT_AUDIO_SOURCE;
}

export type ListenBackground = { id: string; title: string; url: string; credit: string | null };

// Active backgrounds for the Al-Qur'an listening view, oldest first; the anon key and RLS decide what is public.
// They are decoration, so a failed read shows the plain gradient instead of breaking the surah page.
export async function getListenBackgrounds(): Promise<ListenBackground[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");

  const db = createAnonClient();
  const { data, error } = await db.from("listen_backgrounds").select("id, title, storage_path, credit").order("created_at");
  if (error) return [];
  return data.map((b) => ({ id: b.id, title: b.title, credit: b.credit, url: db.storage.from("backgrounds").getPublicUrl(b.storage_path).data.publicUrl }));
}

// Published doa, in the order of the groups; the anon key and RLS decide what is public
export async function getPublishedPrayers(): Promise<Prayer[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");

  const { data, error } = await createAnonClient().from("daily_prayers").select(PRAYER_COLUMNS).order("sort_order");
  if (error) throw new Error(`Supabase: ${error.message}`);
  const rank = (c: string) => {
    const i = PRAYER_CATEGORIES.findIndex((x) => x.id === c);
    return i < 0 ? 999 : i;
  };
  return (data as Prayer[]).sort((a, b) => rank(a.category) - rank(b.category));
}
