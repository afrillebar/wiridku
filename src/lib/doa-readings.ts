import { getPublishedPrayers } from "@/lib/content";
import { PRAYER_CATEGORIES, type DoaAudio } from "@/lib/doa";
import audio from "@/lib/doa-audio.json";
import titles from "@/lib/doa-titles.json";
import { prayerReading, type Reading } from "@/lib/reading";

// The published doa as readings, each with its sound from doa-audio.json (scripts/build-doa.mjs); a doa without sound is left out of the list.
export async function getDoaReadings(): Promise<Reading[]> {
  const clips = audio as DoaAudio;
  return (await getPublishedPrayers()).filter((p) => clips[p.slug]).map((p) => prayerReading(p, clips[p.slug], (titles as Record<string, string>)[p.slug]));
}

export const DOA_GROUPS = PRAYER_CATEGORIES.map((c) => ({ id: c.id, label: c.label }));
