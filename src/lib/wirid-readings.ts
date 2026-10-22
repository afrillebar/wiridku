import type { Phase, Recitation } from "@/lib/content";
import { alignedLines, clipLines, voiceOf, type ReadLine, type Reading } from "@/lib/reading";
import { splitSurahParts } from "@/lib/surah-parts";
import { splitAt, wiridAudio } from "@/lib/wirid-audio";

// the name in Arabic of each card, shown on the right of the list and of the header
const ARABIC: Record<string, string> = {
  "f1-1": "الاستغفار",
  "f1-2": "التهليل",
  "f1-3": "اللهم أنت السلام",
  "f1-4": "اللهم أعني على ذكرك",
  "f1-5": "اللهم لا مانع لما أعطيت",
  "f1-6": "التهليل وحمد الله",
  "f1-7": "الاستجارة من النار",
  "f2-1": "الفاتحة",
  "f2-2": "آية الكرسي",
  "f2-3": "التسبيح والتحميد والتكبير",
  "f2-4": "الإخلاص والفلق والناس",
  "f3-0": "البسملة والحمد",
  "f3-0b": "الصلاة الإبراهيمية",
  "f3-1": "ربنا ظلمنا أنفسنا",
  "f3-2": "رب ارحمهما",
  "f3-3": "ربنا لا تزغ قلوبنا",
  "f3-4": "ربنا هب لنا من أزواجنا",
  "f3-5": "اللهم إني أسألك علما نافعا",
  "f3-6": "ربنا لا تؤاخذنا",
  "f3-7": "ربنا تقبل منا",
  "f3-8": "اللهم عافني في بدني",
};

// One card of Wirid Salat as a reading. A card that opens each surah with bismillah is read as one line per surah, named; otherwise as the lines it is written in.
function lines(r: Recitation): ReadLine[] {
  const parts = splitSurahParts(r);
  if (parts) return parts.map((p, i) => ({ n: String(i + 1), ar: p.arabic, la: p.latin, ti: p.translation, key: p.name || undefined, name: p.name || undefined }));
  return alignedLines(r.arabic_text, r.transliteration, r.translation);
}

export function wiridReadings(phases: Phase[]): Reading[] {
  return phases.flatMap((p) =>
    p.recitations.map((r): Reading => {
      const showReference = r.reference_text && r.reference_text !== r.chip_label;
      let own = lines(r);
      const online = wiridAudio[r.slug];
      // a card made of sentences from several places is read one sentence at a time: its own text, cut where the sound was cut
      if (online?.cuts) {
        const ar = splitAt(r.arabic_text, online.cuts.ar);
        if (ar) {
          const la = splitAt(r.transliteration, online.cuts.la);
          const ti = splitAt(r.translation, online.cuts.ti);
          own = ar.map((a, i) => ({ n: String(i + 1), ar: a, la: la?.length === ar.length ? la[i] : null, ti: ti?.length === ar.length ? ti[i] : null }));
        }
      }
      // ponytail: the online sound was cut for the text the card had; once the text is edited so its lines no longer match, the card falls back to its own recording
      const streamed = online && clipLines(online.clips) === own.length ? online.clips : null;
      const clips = streamed ?? (r.audio ? [{ url: r.audio.url ?? "" }] : []);
      return {
        slug: r.slug,
        title: r.title,
        arabic: ARABIC[r.slug],
        sub: [p.title, r.chip_label].filter(Boolean).join(" · "),
        group: p.slug,
        voice: streamed ? voiceOf(streamed) : r.audio?.synthetic ? "Suara sintetis" : r.audio ? "Rekaman asli" : "Tanpa audio",
        ref: showReference ? r.reference_text : null,
        lines: own,
        clips,
        extra: {
          phase: p.title,
          chip: r.chip_label,
          number: r.display_number,
          tasbih: r.kind === "tasbih" ? (r.tasbih_config?.steps ?? null) : null,
          offline: !streamed && r.audio?.offline ? { path: r.audio.path, version: r.audio.version, synthetic: r.audio.synthetic } : null,
        },
      };
    }),
  );
}
