// Doa Harian: the groups (in the order they appear) and the row shape shared by the public page and the admin.
export const PRAYER_CATEGORIES = [
  { id: "tidur", label: "Bangun & Tidur" },
  { id: "bersuci", label: "Bersuci" },
  { id: "rumah", label: "Rumah & Pakaian" },
  { id: "masjid", label: "Masjid & Azan" },
  { id: "makan", label: "Makan & Minum" },
  { id: "perjalanan", label: "Perjalanan" },
  { id: "sakit", label: "Sakit & Musibah" },
  { id: "kesulitan", label: "Kesulitan & Rezeki" },
  { id: "cuaca", label: "Hujan & Angin" },
  { id: "pergaulan", label: "Pergaulan & Keluarga" },
  { id: "pagipetang", label: "Pagi & Petang" },
  { id: "quran", label: "Doa dari Al-Qur'an" },
] as const;

export type PrayerCategory = (typeof PRAYER_CATEGORIES)[number]["id"];
export const isPrayerCategory = (v: string): v is PrayerCategory => PRAYER_CATEGORIES.some((c) => c.id === v);
export const categoryLabel = (id: string) => PRAYER_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export type Prayer = {
  id: string;
  slug: string;
  category: string;
  title: string;
  arabic_text: string;
  transliteration: string | null;
  translation: string | null;
  reference_text: string | null;
  note: string | null;
  repeat_label: string | null;
};

export const PRAYER_COLUMNS = "id, slug, category, title, arabic_text, transliteration, translation, reference_text, note, repeat_label";

// Where a doa is heard: streamed from the source, nothing is stored here. from/to (seconds) cut the doa out of a longer file; none means the whole file.
// A doa with several clips plays them one after another. Built by scripts/build-doa.mjs.
// marks: when one clip holds several lines of the text (verses of a surah), the second at which each line starts in the file, so the page can follow the sound.
export type DoaClip = { url: string; from?: number; to?: number; marks?: number[] };
export type DoaAudio = Record<string, DoaClip[]>;
