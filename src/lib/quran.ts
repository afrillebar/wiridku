import "server-only";
import { cacheLife } from "next/cache";
import { SURAH_COUNT, type Qari, type Recitation, type Surah, type Verse } from "@/lib/quran-types";

// Text, translation and audio come from Quran.com: Uthmani script, the Kemenag Indonesian translation (33),
// the reciters and each verse's timing. The latin reading comes from equran.id, which follows the Kemenag
// transliteration guide (Quran.com only has an English-style one). Failures throw, so they are never cached.
const API = "https://api.quran.com/api";
const LATIN_API = "https://equran.id/api/v2/surat";
const TRANSLATION = 33;

// the build fetches all 114 surahs at once, so one dropped connection is retried once before failing
async function get<T>(path: string, base = API, retry = true): Promise<T> {
  try {
    const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`${base}${path}: ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if (!retry) throw e;
    await new Promise((r) => setTimeout(r, 1500));
    return get<T>(path, base, false);
  }
}

// the Kemenag text carries footnote markers such as <sup foot_note=134955>1</sup>
const clean = (s: string) =>
  s
    .replace(/<sup[^>]*>.*?<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const isSurahId = (n: number) => Number.isInteger(n) && n >= 1 && n <= SURAH_COUNT;

type RawChapter = {
  id: number;
  name_simple: string;
  name_arabic: string;
  revelation_place: "makkah" | "madinah";
  verses_count: number;
  bismillah_pre: boolean;
  translated_name: { name: string };
};

export async function getSurahs(): Promise<Surah[]> {
  "use cache";
  cacheLife("max");
  const { chapters } = await get<{ chapters: RawChapter[] }>("/v4/chapters?language=id");
  return chapters.map((c) => ({
    id: c.id,
    name: c.name_simple,
    arabic: c.name_arabic,
    meaning: c.translated_name.name,
    place: c.revelation_place,
    verses: c.verses_count,
    bismillah: c.bismillah_pre,
  }));
}

type RawVerse = { verse_number: number; text_uthmani: string; translations: { resource_id: number; text: string }[] };

export async function getVerses(surah: number): Promise<Verse[]> {
  "use cache";
  cacheLife("max");
  // the longest surah has 286 verses, so one page holds any surah
  const [{ verses }, { data }] = await Promise.all([
    get<{ verses: RawVerse[] }>(`/v4/verses/by_chapter/${surah}?translations=${TRANSLATION}&fields=text_uthmani&per_page=300`),
    get<{ data: { ayat: { nomorAyat: number; teksLatin: string }[] } }>(`/${surah}`, LATIN_API),
  ]);
  const latin = new Map(data.ayat.map((a) => [a.nomorAyat, clean(a.teksLatin)]));
  return verses.map((v) => ({
    n: v.verse_number,
    arabic: v.text_uthmani.trim(),
    latin: latin.get(v.verse_number) ?? "",
    arti: clean(v.translations.find((t) => t.resource_id === TRANSLATION)?.text ?? ""),
  }));
}

type RawReciter = { id: number; name: string; style: { name: string } };

export async function getQaris(): Promise<Qari[]> {
  "use cache";
  cacheLife("weeks");
  const { reciters } = await get<{ reciters: RawReciter[] }>("/qdc/audio/reciters?locale=id");
  const seen = new Set<string>();
  return reciters
    .map((r) => ({ id: r.id, name: r.style.name === "Murattal" ? r.name : `${r.name} (${r.style.name})` }))
    .filter((q) => !seen.has(q.name) && seen.add(q.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

type RawAudio = { audio_url: string; verse_timings?: { timestamp_from: number; timestamp_to: number }[] };

export async function getRecitation(qari: number, surah: number): Promise<Recitation> {
  "use cache";
  cacheLife("weeks");
  const { audio_files } = await get<{ audio_files: RawAudio[] }>(`/qdc/audio/reciters/${qari}/audio_files?chapter=${surah}&segments=true`);
  const file = audio_files[0];
  if (!file?.audio_url) throw new Error(`no audio for qari ${qari} surah ${surah}`);
  const timings = (file.verse_timings ?? []).map((t) => [t.timestamp_from, t.timestamp_to] as [number, number]);
  return { url: file.audio_url, timings };
}
