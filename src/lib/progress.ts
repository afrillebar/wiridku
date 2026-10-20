import { useCallback, useMemo, useSyncExternalStore } from "react";

const PROGRESS_KEY = "wirid_progress_v1";
const STREAK_KEY = "wirid_streak_v1";
const FONT_KEY = "wirid_font_v1";
const PLACE_KEY = "wirid_place_v1";
const EVENT = "wirid-storage";
const MIN_STEP = -2;
const MAX_STEP = 4;

type Streak = { lastDate: string | null; streak: number };

const pad = (n: number) => String(n).padStart(2, "0");
// ponytail: local date, not toISOString (UTC), so the day rolls over at local midnight
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => fmt(new Date());
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return fmt(d);
};

const read = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown, notify = true) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  if (notify) window.dispatchEvent(new Event(EVENT));
};

const clampStep = (n: number) => Math.min(MAX_STEP, Math.max(MIN_STEP, Number.isFinite(n) ? Math.round(n) : 0));

const readDone = (): string[] => {
  const p = read(PROGRESS_KEY) as { date?: string; done?: string[] } | null;
  return p?.date === today() && Array.isArray(p.done) ? p.done : [];
};
const readStreak = (): Streak => {
  const s = read(STREAK_KEY) as Streak | null;
  return { lastDate: s?.lastDate ?? null, streak: s?.streak ?? 0 };
};

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

// ponytail: snapshots are strings so React compares them by value and the Date calls stay client-only
export function useProgress(validIds: string[]) {
  const doneRaw = useSyncExternalStore(subscribe, () => JSON.stringify(readDone()), () => "[]");
  const streakRaw = useSyncExternalStore(
    subscribe,
    () => {
      const s = readStreak();
      return String(s.lastDate === today() || s.lastDate === yesterday() ? s.streak : 0);
    },
    () => "0",
  );
  const done = useMemo(() => new Set<string>(JSON.parse(doneRaw)), [doneRaw]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(readDone());
      if (!next.delete(id)) next.add(id);
      write(PROGRESS_KEY, { date: today(), done: [...next] });

      if (validIds.length > 0 && validIds.every((v) => next.has(v))) {
        const s = readStreak();
        if (s.lastDate !== today()) {
          write(STREAK_KEY, { lastDate: today(), streak: s.lastDate === yesterday() ? s.streak + 1 : 1 });
        }
      }
    },
    [validIds],
  );

  return { done, streak: Number(streakRaw), toggle };
}

// What the reader shows and how big. Sizes are in px; ranges and defaults are shared with the settings page.
export const TEXT_LIMITS = { arab: [20, 48], latin: [11, 24], arti: [11, 24] } as const;
export const TEXT_DEFAULTS = { arab: 27, latin: 15, arti: 14 } as const;
export type TextPrefs = { showLatin: boolean; showArti: boolean; arab: number; latin: number; arti: number };
const TEXT_KEY = "wirid_text_v1";

const px = (n: unknown, [lo, hi]: readonly [number, number], fallback: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback);

const readText = (): TextPrefs => {
  const s = (read(TEXT_KEY) ?? {}) as Partial<TextPrefs>;
  // ponytail: a visitor who sized the Arabic text with the old steps (about 3 px each) keeps that size
  const old = read(FONT_KEY);
  const fromStep = Math.round(TEXT_DEFAULTS.arab + clampStep(typeof old === "number" ? old : 0) * 2.88);
  return {
    showLatin: s.showLatin !== false,
    showArti: s.showArti !== false,
    arab: px(s.arab, TEXT_LIMITS.arab, px(fromStep, TEXT_LIMITS.arab, TEXT_DEFAULTS.arab)),
    latin: px(s.latin, TEXT_LIMITS.latin, TEXT_DEFAULTS.latin),
    arti: px(s.arti, TEXT_LIMITS.arti, TEXT_DEFAULTS.arti),
  };
};
const TEXT_SERVER = JSON.stringify({ showLatin: true, showArti: true, ...TEXT_DEFAULTS });

export function useTextPrefs() {
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(readText()), () => TEXT_SERVER);
  const prefs = useMemo(() => JSON.parse(raw) as TextPrefs, [raw]);
  const set = useCallback((patch: Partial<TextPrefs>) => write(TEXT_KEY, { ...readText(), ...patch }), []);
  return { ...prefs, set };
}

export function readPlace() {
  const value = read(PLACE_KEY);
  return typeof value === "string" && value ? value : null;
}

export function usePlace() {
  return useSyncExternalStore(subscribe, readPlace, () => null);
}

export function writePlace(slug: string) {
  write(PLACE_KEY, slug, false);
}

// Al-Qur'an: the chosen reciter, whether the page follows the recitation, and the last place listened to.
// t is the second inside the surah's audio file for that reciter; ayah is the verse playing at t.
// Listening view: bg is a background id, "none" for the plain gradient, or null for the first one the admin added;
// ambient is a background sound id (checked by the player) or null; ambientVol runs 0..1.
// lsnArab/lsnLatin/lsnArti choose the text in the listening view, apart from the reading page's own choice.
export type QuranPlace = { surah: number; qari: number; t: number; ayah: number };
export type QuranPrefs = {
  qari: number;
  follow: boolean;
  bg: string | null;
  ambient: string | null;
  ambientVol: number;
  autoNext: boolean;
  lsnArab: boolean;
  lsnLatin: boolean;
  lsnArti: boolean;
};
const QURAN_PREFS_DEFAULT = { follow: true, bg: null, ambient: null, ambientVol: 0.5, autoNext: true, lsnArab: true, lsnLatin: false, lsnArti: true };
const QURAN_PREFS_KEY = "wirid_quran_prefs_v1";
const QURAN_PLACE_KEY = "wirid_quran_place_v1";
const posInt = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null);
const shortText = (v: unknown) => (typeof v === "string" && v && v.length <= 64 ? v : null);

const readQuranPrefs = (defaultQari: number): QuranPrefs => {
  const s = (read(QURAN_PREFS_KEY) ?? {}) as Partial<QuranPrefs>;
  return {
    qari: posInt(s.qari) ?? defaultQari,
    follow: s.follow !== false,
    bg: shortText(s.bg),
    ambient: shortText(s.ambient),
    ambientVol: typeof s.ambientVol === "number" && s.ambientVol >= 0 && s.ambientVol <= 1 ? s.ambientVol : 0.5,
    autoNext: s.autoNext !== false,
    lsnArab: s.lsnArab !== false,
    lsnLatin: s.lsnLatin === true,
    lsnArti: s.lsnArti !== false,
  };
};

export function useQuranPrefs(defaultQari: number) {
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readQuranPrefs(defaultQari)),
    () => JSON.stringify({ qari: defaultQari, ...QURAN_PREFS_DEFAULT } satisfies QuranPrefs),
  );
  const prefs = useMemo(() => JSON.parse(raw) as QuranPrefs, [raw]);
  const set = useCallback((patch: Partial<QuranPrefs>) => write(QURAN_PREFS_KEY, { ...readQuranPrefs(defaultQari), ...patch }), [defaultQari]);
  return { ...prefs, set };
}

export function readQuranPlace(): QuranPlace | null {
  const p = read(QURAN_PLACE_KEY) as Partial<QuranPlace> | null;
  const surah = posInt(p?.surah);
  const qari = posInt(p?.qari);
  if (!surah || !qari) return null;
  return { surah, qari, t: typeof p?.t === "number" && p.t > 0 ? p.t : 0, ayah: posInt(p?.ayah) ?? 1 };
}

export function useQuranPlace() {
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(readQuranPlace()), () => "null");
  return useMemo(() => JSON.parse(raw) as QuranPlace | null, [raw]);
}

// saved every few seconds while playing, so other components are not re-rendered for it
export function writeQuranPlace(place: QuranPlace) {
  write(QURAN_PLACE_KEY, place, false);
}

export function clearQuranPlace() {
  try {
    localStorage.removeItem(QURAN_PLACE_KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

// Pengaturan > Penyimpanan Data: what is stored, and wiping it.
export function useProgressSummary() {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      const s = readStreak();
      const streak = s.lastDate === today() || s.lastDate === yesterday() ? s.streak : 0;
      return JSON.stringify([readDone().length, streak, readPlace()]);
    },
    () => "[0,0,null]",
  );
  const [done, streak, place] = JSON.parse(raw) as [number, number, string | null];
  return { done, streak, place };
}

export function clearProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(STREAK_KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function clearPlace() {
  try {
    localStorage.removeItem(PLACE_KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
