// A card that opens each surah with bismillah is split so Arabic, the reading, and the meaning stay with that surah.
const MARKS = {
  arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  latin: "Bismillaahir rahmaanir rahiim",
  translation: "Dengan nama Allah Yang Maha Pengasih lagi Maha Penyayang",
};

export type SurahPart = { name: string; arabic: string; latin: string; translation: string };

function pieces(text: string | null, mark: string): string[] | null {
  if (!text?.startsWith(mark)) return null;
  const parts = text
    .split(mark)
    .slice(1)
    .map((bit) => `${mark}${bit}`.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts : null;
}

export function splitSurahParts(reading: {
  title: string;
  arabic_text: string | null;
  transliteration: string | null;
  translation: string | null;
}): SurahPart[] | null {
  const arabic = pieces(reading.arabic_text, MARKS.arabic);
  const latin = pieces(reading.transliteration, MARKS.latin);
  const translation = pieces(reading.translation, MARKS.translation);
  if (!arabic || !latin || !translation) return null;
  if (arabic.length !== latin.length || arabic.length !== translation.length) return null;

  const names = reading.title.split(/\s*[,&]\s*/).map((name) => name.trim()).filter(Boolean);
  const labels = names.length === arabic.length ? names : arabic.map(() => "");
  return arabic.map((text, i) => ({ name: labels[i], arabic: text, latin: latin[i], translation: translation[i] }));
}
