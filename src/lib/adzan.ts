import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { PrayerKey } from "./prayer";

// Mishary Rashid Alafasy's adhan from Internet Archive, streamed when the time comes (nothing is stored); the Fajr one has "as-salatu khairun minan-naum"
export const ADZAN_URL = {
  regular: "https://archive.org/download/AdzanMisyariRasyid2/Adzan-Misyari-Rasyid_2.mp3",
  subuh: "https://archive.org/download/adhan-call-to-prayer-mishary-rashid-alafasy-fajr-maqam-hijaz-hd-320-kbps-1/Adhan%20%28Call%20to%20prayer%29%20_%20Mishary%20Rashid%20Alafasy%20_%20Fajr%20_%20Maqam%20Hijaz%20%E1%B4%B4%E1%B4%B0%20%28320%20kbps%29%20%281%29.mp3",
} as const;
export const adzanUrl = (key: PrayerKey) => (key === "subuh" ? ADZAN_URL.subuh : ADZAN_URL.regular);

export type AdzanPrefs = { on: boolean; sound: boolean; notify: boolean; prayers: Record<PrayerKey, boolean> };
// on from the start: the visitor turns it off in Pengaturan > Adzan & Notifikasi
const DEFAULTS: AdzanPrefs = { on: true, sound: true, notify: true, prayers: { subuh: true, dzuhur: true, ashar: true, maghrib: true, isya: true } };
const KEY = "wirid_adzan_v1";
const FIRED_KEY = "wirid_adzan_fired_v1";
const ASKED_KEY = "wirid_adzan_asked_v1";
const EVENT = "wirid-adzan";

const readPrefs = (): AdzanPrefs => {
  let s: Partial<AdzanPrefs> & { prayers?: Partial<Record<PrayerKey, boolean>> } = {};
  try {
    s = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {}
  return {
    on: s.on !== false,
    sound: s.sound !== false,
    notify: s.notify !== false,
    prayers: Object.fromEntries(Object.entries(DEFAULTS.prayers).map(([k, d]) => [k, s.prayers?.[k as PrayerKey] ?? d])) as AdzanPrefs["prayers"],
  };
};

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export function useAdzanPrefs() {
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(readPrefs()), () => JSON.stringify(DEFAULTS));
  const prefs = useMemo(() => JSON.parse(raw) as AdzanPrefs, [raw]);
  const set = useCallback((patch: Partial<Omit<AdzanPrefs, "prayers">> & { prayers?: Partial<AdzanPrefs["prayers"]> }) => {
    const cur = readPrefs();
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...cur, ...patch, prayers: { ...cur.prayers, ...patch.prayers } }));
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { ...prefs, set };
}

// ponytail: the same prayer must not sound twice when two tabs are open or the page is reloaded within its minute; the last few are kept
export function claimAdzan(id: string) {
  try {
    const fired: string[] = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]");
    if (fired.includes(id)) return false;
    localStorage.setItem(FIRED_KEY, JSON.stringify([...fired, id].slice(-12)));
  } catch {}
  return true;
}

// the notification permission is asked once, at the first tap, since browsers only allow the question from a tap
export function claimNotificationAsk() {
  try {
    if (localStorage.getItem(ASKED_KEY)) return false;
    localStorage.setItem(ASKED_KEY, "1");
  } catch {}
  return true;
}
