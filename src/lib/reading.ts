import type { TasbihStep } from "./content";
import type { DoaClip, Prayer } from "./doa";
import { categoryLabel } from "./doa";
import type { ReadingModuleId } from "./progress";
import type { ReadingRow } from "./readings";

// A reading is one thing to read and hear: a doa, a shalawat, a part of the tahlil. Like a surah it is a list of lines (verses),
// and its sound is a list of clips; a clip with marks holds several lines (the verses of a surah), the others hold one line each.
// name: the surah a line belongs to, when a reading holds several (Al-Ikhlas, Al-Falaq, An-Nas)
export type ReadLine = { n: string; ar: string; la: string | null; ti: string | null; key?: string; name?: string };

// what Wirid Salat adds to a reading: its phase, the counter of a tasbih card, a recording that can be saved for offline
export type WiridExtra = {
  phase: string;
  chip: string | null;
  number: number | null;
  tasbih: TasbihStep[] | null;
  offline: { path: string; version: number; synthetic: boolean } | null;
};
// the verses of a surah a reading is made of, when its sound can come from any reciter of Quran.com; verses is how many the surah has
export type QuranRef = { surah: number; from: number; to: number; verses: number };

export type Reading = {
  slug: string;
  title: string;
  // the name in Arabic, shown on the right of the list and of the header
  arabic?: string;
  // whose voice it is, for the reciter row when there is no other to choose
  voice: string;
  quran?: QuranRef[];
  extra?: WiridExtra;
  sub: string;
  // the list it is filed under (the doa categories)
  group?: string;
  // where the text comes from, kept short: "HR. Bukhari dan Muslim"
  ref: string | null;
  lines: ReadLine[];
  clips: DoaClip[];
};

export type ReadingModule = {
  id: ReadingModuleId;
  base: string;
  heading: string;
  // what one entry is called ("doa") and what a line is called ("baris")
  part: string;
  unit: string;
};

export const MODULES: Record<ReadingModuleId, ReadingModule> = {
  doa: { id: "doa", base: "/doa-harian", heading: "Doa Harian", part: "doa", unit: "baris" },
  tahlil: { id: "tahlil", base: "/tahlil", heading: "Tahlil & Yasin", part: "bacaan", unit: "baris" },
  shalawat: { id: "shalawat", base: "/shalawat", heading: "Shalawat", part: "shalawat", unit: "baris" },
  wirid: { id: "wirid", base: "/wirid-salat", heading: "Wirid Salat", part: "wirid", unit: "baris" },
};

// how many lines the clips of a reading cover; if it is not the number of lines, the page cannot follow the sound line by line
export const clipLines = (clips: DoaClip[]) => clips.reduce((n, c) => n + (c.marks?.length ?? 1), 0);

const split = (s: string | null) => (s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

// Arabic, latin and meaning are written line for line; when they line up they are read as one line each
export function alignedLines(arabic: string | null, latin: string | null, meaning: string | null): ReadLine[] {
  const ar = split(arabic);
  const la = split(latin);
  const ti = split(meaning);
  const same = (n: number) => n === 0 || n === ar.length;
  if (same(la.length) && same(ti.length)) return ar.map((a, i) => ({ n: String(i + 1), ar: a, la: la[i] ?? null, ti: ti[i] ?? null }));
  return [{ n: "1", ar: ar.join("\n"), la: la.join("\n") || null, ti: ti.join("\n") || null }];
}

export const prayerLines = (p: Prayer) => alignedLines(p.arabic_text, p.transliteration, p.translation);

// whose voice a list of clips is, from where they are streamed
export function voiceOf(clips: DoaClip[]) {
  if (!clips.length) return "Tanpa audio";
  const from = (host: string) => clips.every((c) => c.url.includes(host));
  return from("quranicaudio.com") ? "Mishari Rashid al-`Afasy" : from("archive.org") ? "Internet Archive" : "Hisnul Muslim";
}

export function prayerReading(p: Prayer, clips: DoaClip[], arabic?: string): Reading {
  return { slug: p.slug, title: p.title, arabic, voice: voiceOf(clips), sub: [categoryLabel(p.category), p.repeat_label].filter(Boolean).join(" · "), group: p.category, ref: p.reference_text, lines: prayerLines(p), clips };
}

// the readings as the listening view wants them: a Surah-shaped entry for each, so its list and its previous/next buttons work unchanged
export const asSurahs = (readings: Reading[]) =>
  readings.map((r, i) => ({ id: i + 1, name: r.title, arabic: r.arabic ?? "", meaning: r.sub, place: "makkah" as const, verses: r.lines.length, bismillah: false }));

// a reading written in the admin (not read from Quran.com): one line for each block, one clip for each line
export const textReading = (row: ReadingRow): Reading => ({
  slug: row.slug,
  title: row.title,
  arabic: row.arabic_title ?? undefined,
  voice: voiceOf(row.clips),
  sub: row.sub_label ?? "",
  ref: row.reference_text,
  lines: row.blocks.map((b, i) => ({ n: String(i + 1), ar: b.ar, la: b.la, ti: b.ti })),
  clips: row.clips,
});
