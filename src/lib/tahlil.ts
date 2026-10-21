import "server-only";
import { cacheLife } from "next/cache";
import type { DoaClip } from "@/lib/doa";
import { getRecitation, getSurahs, getVerses } from "@/lib/quran";
import { DEFAULT_QARI } from "@/lib/quran-types";
import dzikir from "./tahlil-dzikir.json";

// Tahlil and Yasin: the usual order of a tahlil as read in Indonesia. The Qur'an parts come from Quran.com like the Al-Qur'an menu
// (text, meaning, and where each verse sits in Alafasy's recording); the dzikir and doa come from Hisnul Muslim (scripts/build-tahlil.mjs).
export type TahlilPart = {
  slug: string;
  title: string;
  note: string | null;
  ref: string | null;
  // n: the verse, as "36:1", for the parts that are Qur'an
  lines: { ar: string; la: string | null; ti: string | null; n?: string }[];
  clips: DoaClip[];
};

type Range = { surah: number; from?: number; to?: number };
const QURAN: { slug: string; title: string; note: string | null; ranges: Range[] }[] = [
  { slug: "yasin", title: "Surah Yasin", note: "83 ayat, dibaca urut dari awal sampai akhir.", ranges: [{ surah: 36 }] },
  { slug: "al-fatihah", title: "Al-Fatihah", note: null, ranges: [{ surah: 1 }] },
  { slug: "ikhlas-falaq-nas", title: "Al-Ikhlas, Al-Falaq, dan An-Nas", note: "Tiga surah pendek, dibaca berurutan.", ranges: [{ surah: 112 }, { surah: 113 }, { surah: 114 }] },
  { slug: "baqarah-1-5", title: "Al-Baqarah ayat 1-5", note: "Awal surah Al-Baqarah.", ranges: [{ surah: 2, from: 1, to: 5 }] },
  { slug: "ayat-kursi", title: "Ayat Kursi", note: "Al-Baqarah ayat 255.", ranges: [{ surah: 2, from: 255, to: 255 }] },
  { slug: "baqarah-284-286", title: "Al-Baqarah ayat 284-286", note: "Tiga ayat penutup surah Al-Baqarah.", ranges: [{ surah: 2, from: 284, to: 286 }] },
];

// a verse's own start and end inside the surah's file; the first verse starts after the opening basmalah, so a surah here begins at its first verse
const seconds = (ms: number) => Math.round(ms / 10) / 100;

export async function getTahlil(): Promise<TahlilPart[]> {
  "use cache";
  cacheLife("weeks");

  const surahs = await getSurahs();
  const quran = await Promise.all(
    QURAN.map(async (q): Promise<TahlilPart> => {
      const lines: TahlilPart["lines"] = [];
      const clips: DoaClip[] = [];
      for (const r of q.ranges) {
        const [verses, rec] = await Promise.all([getVerses(r.surah), getRecitation(DEFAULT_QARI, r.surah)]);
        // without one timing per verse the stretch cannot be cut out, and a wrong cut is worse than none
        if (rec.timings.length !== verses.length) throw new Error(`tahlil: surah ${r.surah} has ${verses.length} verses but ${rec.timings.length} timings`);
        const from = r.from ?? 1;
        const to = r.to ?? verses.length;
        clips.push({ url: rec.url, from: seconds(rec.timings[from - 1][0]), to: seconds(rec.timings[to - 1][1]) });
        for (const v of verses.slice(from - 1, to)) lines.push({ ar: v.arabic, la: v.latin || null, ti: v.arti || null, n: `${r.surah}:${v.n}` });
      }
      const names = q.ranges.map((r) => surahs[r.surah - 1].name);
      const ref = `QS. ${names.length > 1 ? names.join(", ") : `${names[0]}${q.ranges[0].from ? `: ${q.ranges[0].from === q.ranges[0].to ? q.ranges[0].from : `${q.ranges[0].from}-${q.ranges[0].to}`}` : ""}`}`;
      return { slug: q.slug, title: q.title, note: q.note, ref, lines, clips };
    }),
  );
  const rest: TahlilPart[] = dzikir.map((d) => ({ slug: d.slug, title: d.title, note: d.note, ref: d.ref, lines: d.blocks.map((b) => ({ ar: b.ar, la: b.la, ti: b.ti })), clips: d.clips }));
  return [...quran, ...rest];
}
