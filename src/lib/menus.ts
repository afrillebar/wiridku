// The menus of the home page; the admin can hide any of them from there (the pages themselves stay reachable by link)
export const MENUS = [
  { href: "/wirid-salat", name: "Wirid Salat" },
  { href: "/alquran", name: "Al-Qur'an" },
  { href: "/tasbih", name: "Tasbih" },
  { href: "/doa-harian", name: "Doa Harian" },
  { href: "/tahlil", name: "Tahlil & Yasin" },
  { href: "/shalawat", name: "Shalawat" },
  { href: "/arah-kiblat", name: "Arah Kiblat" },
  { href: "/kalender", name: "Kalender" },
  { href: "/jadwal-salat", name: "Jadwal Salat" },
] as const;

export function parseHiddenMenus(value: unknown): string[] {
  const hidden = (value as { hidden?: unknown } | null)?.hidden;
  return Array.isArray(hidden) ? MENUS.map((m) => m.href).filter((href) => hidden.includes(href)) : [];
}
