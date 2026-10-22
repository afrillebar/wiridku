import "server-only";
import type { DoaClip } from "@/lib/doa";
import { getReadingRows } from "@/lib/content";
import { getRecitation, getVerses } from "@/lib/quran";
import { DEFAULT_QARI } from "@/lib/quran-types";
import { textReading, voiceOf, type QuranRef, type ReadLine, type Reading } from "@/lib/reading";

// Tahlil and Yasin: the readings written in the admin (table readings). Those of kind "quran" come from Quran.com like the Al-Qur'an menu
// (text, meaning, and where each verse sits in Alafasy's recording); the others carry their own text and sound.

// a verse's own start in the surah's file, in seconds; a surah here begins at its first verse, after the opening basmalah
const seconds = (ms: number) => Math.round(ms / 10) / 100;

// ponytail: not a "use cache" function itself; the surah pages ask getVerses/getRecitation at the same moment, and a cached call inside another one fails on the shared request
export async function getTahlil(): Promise<Reading[]> {
  const out: Reading[] = [];
  for (const row of await getReadingRows("tahlil")) {
    if (row.kind === "text") {
      out.push(textReading(row));
      continue;
    }
    const lines: ReadLine[] = [];
    const clips: DoaClip[] = [];
    const refs: QuranRef[] = [];
    for (const r of row.quran) {
      const verses = await getVerses(r.surah);
      const rec = await getRecitation(DEFAULT_QARI, r.surah);
      // without one timing per verse the stretch cannot be cut out, and a wrong cut is worse than none
      if (rec.timings.length !== verses.length) throw new Error(`tahlil: surah ${r.surah} has ${verses.length} verses but ${rec.timings.length} timings`);
      const from = r.from ?? 1;
      const to = r.to ?? verses.length;
      refs.push({ surah: r.surah, from, to, verses: verses.length });
      clips.push({ url: rec.url, from: seconds(rec.timings[from - 1][0]), to: seconds(rec.timings[to - 1][1]), marks: rec.timings.slice(from - 1, to).map((v) => seconds(v[0])) });
      for (const v of verses.slice(from - 1, to)) lines.push({ n: String(v.n), key: `${r.surah}:${v.n}`, ar: v.arabic, la: v.latin || null, ti: v.arti || null });
    }
    out.push({ slug: row.slug, title: row.title, arabic: row.arabic_title ?? undefined, voice: voiceOf(clips), quran: refs, sub: `${lines.length} ayat`, ref: null, lines, clips });
  }
  return out;
}
