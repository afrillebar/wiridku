// The typefaces a visitor can pick for the Arabic text and for the Indonesian text (Pengaturan > Tampilan Bacaan).
// css is the same stack the site stylesheet uses for that choice, so the preview in the settings matches the pages.
export const AR_FONTS = [
  { id: "quran", label: "Mushaf (Amiri Quran)", hint: "Seperti mushaf cetak, dengan tanda baca lengkap. Bawaan.", css: "var(--font-quran), var(--font-amiri), serif" },
  { id: "amiri", label: "Amiri", hint: "Naskh klasik yang halus.", css: "var(--font-amiri), serif" },
  { id: "naskh", label: "Naskh Jelas (Noto Naskh)", hint: "Huruf tegas dan tebal, mudah dibaca di layar kecil.", css: "var(--font-naskh), var(--font-amiri), serif" },
  { id: "scheherazade", label: "Scheherazade", hint: "Huruf besar dan lapang, nyaman untuk mata yang mulai lelah.", css: "var(--font-scheherazade), var(--font-amiri), serif" },
] as const;

export const ID_FONTS = [
  { id: "karla", label: "Karla", hint: "Bawaan.", css: "var(--font-karla), sans-serif" },
  { id: "atkinson", label: "Atkinson Hyperlegible", hint: "Dirancang agar tiap huruf mudah dibedakan, untuk penglihatan yang lemah.", css: "var(--font-atkinson), sans-serif" },
  { id: "lexend", label: "Lexend", hint: "Jarak huruf lapang, enak dibaca lama.", css: "var(--font-lexend), sans-serif" },
  { id: "serif", label: "Noto Serif", hint: "Huruf berkaki seperti buku cetak.", css: "var(--font-noto-serif), serif" },
] as const;

export type ArabicFontId = (typeof AR_FONTS)[number]["id"];
export type IndonesianFontId = (typeof ID_FONTS)[number]["id"];
export const DEFAULT_AR_FONT: ArabicFontId = "quran";
export const DEFAULT_ID_FONT: IndonesianFontId = "karla";

export const isArabicFont = (v: unknown): v is ArabicFontId => AR_FONTS.some((f) => f.id === v);
export const isIndonesianFont = (v: unknown): v is IndonesianFontId => ID_FONTS.some((f) => f.id === v);

// Runs in <head> before first paint so the page never shows the default typeface first; skipped in the admin panel.
export const FONT_SCRIPT = `try{var t=JSON.parse(localStorage.getItem("wirid_text_v1")||"{}"),e=document.documentElement;if(location.pathname.indexOf("/putrazea")!==0){if(${JSON.stringify(AR_FONTS.map((f) => f.id))}.indexOf(t.fontAr)>=0)e.dataset.fontAr=t.fontAr;if(${JSON.stringify(ID_FONTS.map((f) => f.id))}.indexOf(t.fontId)>=0)e.dataset.fontId=t.fontId}}catch(e){}`;

// Puts the choice on the page right away (the head script only runs when the page loads).
export function applyFonts(fontAr: string, fontId: string) {
  document.documentElement.dataset.fontAr = fontAr;
  document.documentElement.dataset.fontId = fontId;
}
