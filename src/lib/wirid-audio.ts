import type { DoaClip } from "./doa";
import data from "./wirid-audio.json";

// Where a card of Wirid Salat is heard from: streamed from online sources (scripts/build-wirid-audio.mjs).
// cuts: when the card is read one sentence at a time, the first words of every line after the first, in each of the three texts
export type WiridAudio = { clips: DoaClip[]; cuts?: { ar: string[]; la: string[]; ti: string[] } };

// the text cut at those first words, or null when one of them is no longer in it (the card was edited)
export function splitAt(text: string | null, firsts: string[]): string[] | null {
  if (!text) return null;
  const t = text.normalize("NFC");
  const at = [0];
  for (const w of firsts) {
    const i = t.indexOf(w.normalize("NFC"), at[at.length - 1] + 1);
    if (i < 0) return null;
    at.push(i);
  }
  return at.map((a, k) => t.slice(a, at[k + 1]).replace(/[\s.,،]+$/, "").trim());
}
export const wiridAudio = data as Record<string, WiridAudio>;
