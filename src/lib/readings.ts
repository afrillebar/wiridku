// What the Tahlil & Yasin and Shalawat readings are made of in the database (table readings), and how the admin form writes them as text.
import type { DoaClip } from "./doa";

export type ReadingModuleName = "tahlil" | "shalawat";
export const READING_MODULES: Record<ReadingModuleName, { label: string; path: string }> = {
  tahlil: { label: "Tahlil & Yasin", path: "/tahlil" },
  shalawat: { label: "Shalawat", path: "/shalawat" },
};
export const isReadingModule = (v: string): v is ReadingModuleName => v in READING_MODULES;

export type QuranRange = { surah: number; from?: number; to?: number };
export type ReadingBlock = { ar: string; la: string | null; ti: string | null };
export type ReadingRow = {
  id: string;
  module: ReadingModuleName;
  slug: string;
  title: string;
  arabic_title: string | null;
  kind: "text" | "quran";
  blocks: ReadingBlock[];
  quran: QuranRange[];
  clips: DoaClip[];
  sub_label: string | null;
  reference_text: string | null;
};
export const READING_COLUMNS = "id, module, slug, title, arabic_title, kind, blocks, quran, clips, sub_label, reference_text";

// one range a line: "36" (the whole surah), "2:255", "2:284-286"
export const quranToText = (ranges: QuranRange[]) => ranges.map((r) => (r.from === undefined ? `${r.surah}` : r.from === r.to ? `${r.surah}:${r.from}` : `${r.surah}:${r.from}-${r.to}`)).join("\n");

export function parseQuran(input: string): QuranRange[] | string {
  const out: QuranRange[] = [];
  for (const line of input.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(/^(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/);
    if (!m) return `Baris “${line}” tidak dikenali. Tulis 36, atau 2:255, atau 2:284-286.`;
    const surah = Number(m[1]);
    if (surah < 1 || surah > 114) return `Surah ${surah} tidak ada (1–114).`;
    if (m[2] === undefined) out.push({ surah });
    else {
      const from = Number(m[2]);
      const to = m[3] === undefined ? from : Number(m[3]);
      if (from < 1 || to < from) return `Ayat pada “${line}” tidak urut.`;
      out.push({ surah, from, to });
    }
  }
  return out;
}

// one clip a line: "https://… | dari detik | sampai detik", the seconds are optional
export const clipsToText = (clips: DoaClip[]) => clips.map((c) => [c.url, c.from ?? "", c.to ?? ""].join(" | ").replace(/( \| )+$/, "")).join("\n");

export function parseClips(input: string): DoaClip[] | string {
  const out: DoaClip[] = [];
  for (const line of input.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [url, from, to] = line.split("|").map((x) => x.trim());
    if (!/^https:\/\/[^\s]+$/.test(url ?? "")) return `Tautan audio “${(url ?? "").slice(0, 40)}” harus diawali https://.`;
    const f = from ? Number(from) : undefined;
    const t = to ? Number(to) : undefined;
    if ((f !== undefined && !(f >= 0)) || (t !== undefined && !(t > 0))) return `Detik pada “${line.slice(0, 60)}” harus angka.`;
    if (f !== undefined && t !== undefined && t <= f) return `Detik sampai harus lebih besar dari detik dari (“${line.slice(0, 60)}”).`;
    out.push({ url, ...(f !== undefined ? { from: f } : {}), ...(t !== undefined ? { to: t } : {}) });
  }
  return out;
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

// Arabic, latin and meaning are written line for line; latin and meaning may be left out
export function parseBlocks(arabic: string, latin: string, meaning: string): ReadingBlock[] | string {
  const ar = lines(arabic);
  const la = lines(latin);
  const ti = lines(meaning);
  if (!ar.length) return "Teks Arab wajib diisi.";
  if (la.length && la.length !== ar.length) return `Latin harus ${ar.length} baris seperti Arab (sekarang ${la.length}).`;
  if (ti.length && ti.length !== ar.length) return `Arti harus ${ar.length} baris seperti Arab (sekarang ${ti.length}).`;
  return ar.map((a, i) => ({ ar: a, la: la[i] ?? null, ti: ti[i] ?? null }));
}
