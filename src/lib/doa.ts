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
