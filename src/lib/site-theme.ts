export const SITE_THEMES = [
  { id: "kertas", label: "Kertas", hint: "Krim, hijau sage, dan emas.", color: "#5C7A6A", swatch: ["#faf3e6", "#5c7a6a", "#a07f2e"] },
  { id: "langit", label: "Langit", hint: "Biru lembut di atas kertas putih.", color: "#2C5874", swatch: ["#f4f7fb", "#2c5874", "#3d7ea6"] },
  { id: "zaitun", label: "Zaitun", hint: "Hijau zaitun dan pasir hangat.", color: "#3F4D22", swatch: ["#f3f1e4", "#3f4d22", "#8a6b2f"] },
  { id: "senja", label: "Senja", hint: "Terakota dan krim kemerahan.", color: "#7A3E30", swatch: ["#fbf3ee", "#7a3e30", "#c46b45"] },
  { id: "malam", label: "Malam", hint: "Hijau gelap untuk dibaca malam hari.", color: "#8FB3A0", swatch: ["#121816", "#2f5c48", "#d4b56a"] },
] as const;

export type SiteThemeId = (typeof SITE_THEMES)[number]["id"];

export const DEFAULT_SITE_THEME: SiteThemeId = "kertas";

export function isSiteTheme(value: unknown): value is SiteThemeId {
  return SITE_THEMES.some((theme) => theme.id === value);
}

export function parseSiteTheme(value: unknown): SiteThemeId {
  const id = (value as { id?: string } | null)?.id;
  return isSiteTheme(id) ? id : DEFAULT_SITE_THEME;
}
