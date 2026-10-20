"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PRAYERS, inIndonesia, zoneByOffset, zoneOf, zoneOffsetFor, type City, type DayTimes, type MonthSchedule, type Zone } from "@/lib/prayer";
import { lookupRegion } from "@/lib/region";
import { computeDay } from "@/lib/prayer-calc";
import { track } from "@/lib/track";
import { dayLabel } from "@/lib/calendar";

const CITY_KEY = "wiridku_kota_v1";
const CACHE_KEY = "wiridku_jadwal_v1";
const ASKED_KEY = "wiridku_gps_asked";
const KEEP_MONTHS = 4;

// first visit: the capital of the device's own time zone, clearly labelled and easy to change
const DEFAULT_CITY: Record<string, City> = {
  "Asia/Makassar": { id: "2622", lokasi: "KOTA MAKASSAR", daerah: "SULAWESI SELATAN" },
  "Asia/Jayapura": { id: "3329", lokasi: "KOTA JAYAPURA", daerah: "PAPUA" },
};
const JAKARTA: City = { id: "1301", lokasi: "KOTA JAKARTA", daerah: "DKI JAKARTA" };

const ACRONYMS = new Set(["DKI", "DI", "NTB", "NTT", "GPS"]);
export const pretty = (lokasi: string) =>
  lokasi
    .split(" ")
    .map((w) => (ACRONYMS.has(w) ? w : w.toLowerCase().replace(/(^|[.(])\p{L}/gu, (c) => c.toUpperCase())))
    .join(" ");
const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const monthKey = (id: string, y: number, m: number) => `${id}-${y}-${m}`;

// ---------- small external stores (localStorage + a clock), read with useSyncExternalStore ----------

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribeStore = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

const readCityRaw = () => {
  try {
    return localStorage.getItem(CITY_KEY) ?? "";
  } catch {
    return "";
  }
};
const saveCity = (city: City) => {
  try {
    localStorage.setItem(CITY_KEY, JSON.stringify(city));
  } catch {}
  notify();
  if (city.gps && city.lokasi !== "Lokasi GPS") track("place");
};

let months: Record<string, MonthSchedule> | null = null;
const readMonths = () => {
  if (months === null) {
    try {
      months = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
    } catch {
      months = {};
    }
  }
  return months!;
};
const saveMonth = (key: string, data: MonthSchedule) => {
  const next = { ...readMonths(), [key]: data };
  for (const old of Object.keys(next).slice(0, -KEEP_MONTHS)) delete next[old];
  months = next;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {}
  notify();
};
const NO_MONTHS = {};

// ponytail: the device clock can be wrong; the server time from each schedule response corrects it
let offsetMs = 0;
const ticks = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
const subscribeClock = (cb: () => void) => {
  ticks.add(cb);
  timer ??= setInterval(() => ticks.forEach((t) => t()), 1000);
  return () => {
    ticks.delete(cb);
    if (!ticks.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
};
const nowSeconds = () => Math.floor((Date.now() + offsetMs) / 1000);

// Fetches one month for the city, stores it, and corrects the clock from the server time in the reply.
async function loadMonth(city: City, key: string, y: number, m: number) {
  const sent = Date.now();
  const r = await fetch(`/api/jadwal?kota=${city.id}&tahun=${y}&bulan=${m}`);
  const body = await r.json();
  // ponytail: half the round trip is the best guess for when the server read its clock
  if (typeof body.serverTime === "number") {
    const skew = body.serverTime - (sent + Date.now()) / 2;
    if (Math.abs(skew) > 2000) offsetMs = skew;
  }
  if (!r.ok) throw new Error(body.error);
  saveMonth(key, body as MonthSchedule);
  if (city.daerah !== body.daerah) saveCity({ id: city.id, lokasi: body.lokasi, daerah: body.daerah });
}

// ---------- helpers ----------

function zoned(seconds: number, zone: Zone) {
  const d = new Date((seconds + zone.offset * 3600) * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes(), s: d.getUTCSeconds() };
}
const isoDate = (t: { y: number; m: number; d: number }) => `${t.y}-${pad(t.m)}-${pad(t.d)}`;

function until(minutes: number) {
  if (minutes < 1) return "kurang dari 1 menit lagi";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h ? `${h} jam ` : ""}${m ? `${m} menit ` : ""}lagi`;
}

// ---------- city picker ----------

export const cityKey = (c: City) => `${c.id} ${c.lokasi}`;

export function CityPicker({ current, onPick, onClose, autoFocus = true }: { current: string; onPick: (c: City) => void; onClose: () => void; autoFocus?: boolean }) {
  const [cities, setCities] = useState<City[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    let alive = true;
    fetch("/api/jadwal/kota")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: City[]) => alive && setCities(list))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return (cities ?? []).filter((c) => words.every((w) => `${c.lokasi} ${c.daerah ?? ""}`.toLowerCase().includes(w))).slice(0, 60);
  }, [cities, query]);

  return (
    <div className="city-picker" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <input ref={input} type="search" className="city-search" placeholder="Cari kabupaten/kota, mis. Bandung" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari kabupaten atau kota" />
      {failed && <p className="city-msg">Daftar kota belum bisa dimuat. Periksa koneksi internet.</p>}
      {!failed && !cities && <p className="city-msg">Memuat daftar kota…</p>}
      {cities && (
        <ul className="city-list">
          {shown.map((c) => (
            <li key={cityKey(c)}>
              <button type="button" aria-current={cityKey(c) === current || undefined} onClick={() => onPick(c)}>
                {pretty(c.lokasi)}
                {c.daerah && <small className="city-sub">{pretty(c.daerah)}</small>}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="city-msg">{query.trim() ? "Tidak ditemukan." : `Ketik nama kabupaten atau kota (${cities.length} lokasi).`}</li>}
        </ul>
      )}
    </div>
  );
}

// ---------- shared with the settings pages ----------

export function useCity() {
  const raw = useSyncExternalStore(subscribeStore, readCityRaw, () => null);
  const city: City | null = useMemo(() => {
    if (raw === null) return null; // server render
    try {
      if (raw) return JSON.parse(raw) as City;
    } catch {}
    return DEFAULT_CITY[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? JAKARTA;
  }, [raw]);
  return { city, chosen: !!raw, setCity: saveCity };
}

// Forgets the chosen city and every saved month (Pengaturan > Penyimpanan Data).
export function clearPrayerData() {
  try {
    localStorage.removeItem(CITY_KEY);
    localStorage.removeItem(CACHE_KEY);
  } catch {}
  months = null;
  notify();
}

export function useSavedMonths() {
  return Object.keys(useSyncExternalStore(subscribeStore, readMonths, () => NO_MONTHS as Record<string, MonthSchedule>)).length;
}

// ---------- card ----------

const PRAYER_ICON: Record<string, ReactNode> = {
  subuh: <path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 7V4M9.5 9.5 8 8M14.5 9.5 16 8" />,
  dzuhur: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  ashar: (
    <>
      <circle cx="12" cy="13" r="3.5" />
      <path d="M12 5.5v2M5.5 13h2M16.5 13h2M7.4 8.4l1.4 1.4M16.6 8.4l-1.4 1.4M4 20h16" />
    </>
  ),
  maghrib: <path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v4M10 6l2 2 2-2" />,
  isya: <path d="M18 14.5A7 7 0 1 1 10.5 6a5.5 5.5 0 0 0 7.5 8.5z" />,
};

// ---------- choosing a place: GPS or a Kemenag city ----------

type Gps = { state: "idle" | "locating" | "naming" | "error" | "insecure"; message?: string };

const GPS_ERRORS: Record<number, string> = {
  1: "Izin lokasi ditolak. Izinkan lokasi untuk situs ini di pengaturan browser, atau pilih kota secara manual.",
  2: "Lokasi belum bisa ditentukan. Coba lagi di tempat terbuka, atau pilih kota secara manual.",
  3: "Pencarian lokasi terlalu lama. Coba lagi, atau pilih kota secara manual.",
};

// ponytail: 3 decimals is about 100 m, plenty for prayer times and no need to keep more of someone's position
async function gpsCity(latitude: number, longitude: number): Promise<City> {
  const lat = Math.round(latitude * 1000) / 1000;
  const lon = Math.round(longitude * 1000) / 1000;
  // the name is only a label; if it cannot be found the times still work, shown as "Lokasi GPS"
  const region = await lookupRegion(lat, lon);
  return { id: "gps", lokasi: region?.name ?? "Lokasi GPS", daerah: region?.province, gps: { lat, lon, tz: zoneOffsetFor(lon, Intl.DateTimeFormat().resolvedOptions().timeZone) } };
}

// Opening the site over https: if the visitor has not decided about location yet, the browser asks right away, and "allow" switches the card
// to the GPS place. A GPS place then follows the visitor quietly (only after moving about 1 km). A hand-picked city is only replaced by a new "allow".
function useAskLocation() {
  useEffect(() => {
    if (!window.isSecureContext || !("geolocation" in navigator)) return;
    let alive = true;
    (async () => {
      const state = (await navigator.permissions?.query({ name: "geolocation" }).then((p) => p.state, () => "prompt" as const)) ?? "prompt";
      if (!alive || state === "denied") return;
      let before: string | null = null;
      let saved: City | null = null;
      try {
        before = localStorage.getItem(CITY_KEY);
        saved = before ? (JSON.parse(before) as City) : null;
        if (state === "granted" && saved && !saved.gps) return;
        // ponytail: asked once per browser; a dismissed popup is not repeated on every visit
        if ((state === "prompt" || !saved) && localStorage.getItem(ASKED_KEY)) return;
        if (state === "prompt" || !saved) localStorage.setItem(ASKED_KEY, "1");
      } catch {
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          if (!inIndonesia(coords.latitude, coords.longitude)) return;
          if (saved?.gps && Math.abs(saved.gps.lat - coords.latitude) < 0.01 && Math.abs(saved.gps.lon - coords.longitude) < 0.01) return;
          const found = await gpsCity(coords.latitude, coords.longitude);
          try {
            // the visitor may have picked a city by hand while this was running
            if (localStorage.getItem(CITY_KEY) === before) saveCity(found);
          } catch {}
        },
        () => {},
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
      );
    })();
    return () => {
      alive = false;
    };
  }, []);
}

// The "Gunakan lokasi saya" button plus the city search. Used in the change-location sheet and in Pengaturan.
export function LocationPicker({ current, onPick, onClose = () => {}, autoFocus = false }: { current: string; onPick: (c: City) => void; onClose?: () => void; autoFocus?: boolean }) {
  const [gps, setGps] = useState<Gps>({ state: "idle" });

  const locate = () => {
    if (!("geolocation" in navigator)) return setGps({ state: "error", message: "Perangkat ini tidak mendukung GPS. Pilih kota secara manual." });
    // browsers only hand out the position on https pages (and localhost); explain that instead of a misleading "permission denied"
    if (!window.isSecureContext) return setGps({ state: "insecure" });
    setGps({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (!inIndonesia(coords.latitude, coords.longitude)) return setGps({ state: "error", message: "Lokasi Anda di luar Indonesia. Jadwal hanya tersedia untuk Indonesia; pilih kota secara manual." });
        setGps({ state: "naming" });
        onPick(await gpsCity(coords.latitude, coords.longitude));
      },
      (err) => setGps({ state: "error", message: GPS_ERRORS[err.code] ?? GPS_ERRORS[2] }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  return (
    <div className="loc-picker">
      <button type="button" className="gps-btn" onClick={locate} disabled={gps.state === "locating" || gps.state === "naming"} data-tip="Pakai posisi perangkat ini">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="12" cy="12" r="8" />
          <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
        </svg>
        {gps.state === "locating" ? "Mencari lokasi…" : gps.state === "naming" ? "Mencari nama daerah…" : "Gunakan lokasi saya (GPS)"}
      </button>
      {gps.state === "error" && (
        <p className="gps-msg" role="alert">
          {gps.message}
        </p>
      )}
      {gps.state === "insecure" && <HttpsHint />}
      <p className="gps-note">Waktu salat dihitung di perangkat ini dari posisi Anda. Untuk menampilkan nama daerah, koordinat dikirim sekali ke layanan BigDataCloud dan tidak disimpan oleh Wiridku. Hanya nama daerahnya (bukan koordinat) yang dicatat di statistik kunjungan.</p>
      <p className="or-line">atau pilih kota</p>
      <CityPicker current={current} onPick={onPick} onClose={onClose} autoFocus={autoFocus} />
    </div>
  );
}

function ChangeSheet({ current, onPick, onClose }: { current: string; onPick: (c: City) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = lock;
    };
  }, []);

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" ref={dialog} onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <div className="sheet-head">
          <h2 id="sheet-title">Ganti lokasi</h2>
          <button type="button" className="icon-btn" aria-label="Tutup" data-tip="Tutup" data-tip-align="end" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <LocationPicker current={current} onPick={onPick} onClose={onClose} />
      </div>
    </div>
  );
}

// "Kota Yogyakarta", "Jakarta Pusat", or "Lokasi GPS" when the area name could not be found
export const placeName = (city: City) => (city.gps ? city.lokasi : pretty(city.lokasi));
export const placeDetail = (city: City) => (city.gps ? "GPS" : "");

// Plain http: the browser will not give out the GPS position, whoever the visitor is.
// ponytail: the test link to the local https proxy is only offered on a private LAN address, never to the public
function HttpsHint() {
  const lan = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);
  const url = `https://${location.hostname}:${process.env.NEXT_PUBLIC_DEV_HTTPS_PORT ?? "3443"}${location.pathname}`;
  return (
    <p className="gps-msg" role="alert">
      GPS hanya bisa dipakai di halaman https. Pilih kota secara manual di bawah.
      {lan && (
        <>
          {" "}
          (Pengujian lokal: <a href={url}>{url}</a>, pilih Lanjutkan pada peringatan sertifikat.)
        </>
      )}
    </p>
  );
}

// ---------- the green card ----------

export function PrayerCard() {
  const { city, setCity } = useCity();
  useAskLocation();
  const store = useSyncExternalStore(subscribeStore, readMonths, () => NO_MONTHS as Record<string, MonthSchedule>);
  const now = useSyncExternalStore(subscribeClock, nowSeconds, () => 0);
  const [failed, setFailed] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  // ponytail: Next keeps the page mounted but hidden after navigating away; close the sheet so it is not open on return
  useLayoutEffect(() => () => setChanging(false), []);

  const zone = city?.gps ? zoneByOffset(city.gps.tz) : zoneOf(city?.daerah ?? "");
  const t = zoned(now, zone);
  const tm = zoned(now + 86400, zone);
  const today = isoDate(t);
  const tomorrow = isoDate(tm);
  const nextMonth = t.m === 12 ? { y: t.y + 1, m: 1 } : { y: t.y, m: t.m + 1 };
  const needNext = tomorrow.slice(0, 7) !== today.slice(0, 7);
  const thisKey = city && !city.gps ? monthKey(city.id, t.y, t.m) : "";
  const nextKey = city && !city.gps ? monthKey(city.id, nextMonth.y, nextMonth.m) : "";
  const month = store[thisKey];

  useEffect(() => {
    if (!city || city.gps || !now) return;
    const wanted = [[thisKey, t.y, t.m], ...(needNext ? [[nextKey, nextMonth.y, nextMonth.m]] : [])] as [string, number, number][];
    let alive = true;
    for (const [key, y, m] of wanted) {
      if (readMonths()[key]) continue;
      loadMonth(city, key, y, m)
        .then(() => alive && setFailed(null))
        .catch((e: Error) => alive && setFailed(e.message || "Jadwal belum bisa dimuat."));
    }
    return () => {
      alive = false;
    };
    // ponytail: refetch when the city, the month or the saved data changes (e.g. cleared in Pengaturan), not every second
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city?.id, thisKey, needNext, !!now, store]);

  // the area name may have been missing at detection time (no connection); try again quietly
  const gpsLat = city?.gps?.lat;
  const gpsLon = city?.gps?.lon;
  const unnamed = !!city?.gps && city.lokasi === "Lokasi GPS";
  useEffect(() => {
    if (!unnamed || gpsLat === undefined || gpsLon === undefined || !city) return;
    let alive = true;
    lookupRegion(gpsLat, gpsLon).then((region) => alive && region && setCity({ ...city, lokasi: region.name, daerah: region.province }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unnamed, gpsLat, gpsLon]);

  // a GPS place has no table to look up: its times are calculated for the day shown
  const gps = city?.gps;
  const gpsDay = gps && now ? computeDay(t.y, t.m, t.d, gps) : undefined;
  const gpsTomorrow = gps && now ? computeDay(tm.y, tm.m, tm.d, gps) : undefined;

  const day: DayTimes | undefined = city?.gps ? gpsDay : month?.jadwal.find((j) => j.date === today);
  const tomorrowDay: DayTimes | undefined = city?.gps ? gpsTomorrow : (store[needNext ? nextKey : thisKey] ?? month)?.jadwal.find((j) => j.date === tomorrow);
  const nowMin = t.h * 60 + t.min + t.s / 60;
  const idx = day ? PRAYERS.findIndex((p) => toMinutes(day[p.key]) > nowMin) : -1;
  const next = day
    ? idx >= 0
      ? { label: PRAYERS[idx].label, key: PRAYERS[idx].key, time: day[PRAYERS[idx].key], at: toMinutes(day[PRAYERS[idx].key]), tomorrow: false }
      : tomorrowDay
        ? { label: "Subuh", key: "subuh", time: tomorrowDay.subuh, at: 1440 + toMinutes(tomorrowDay.subuh), tomorrow: true }
        : null
    : null;
  const left = next ? Math.max(0, Math.ceil(next.at - nowMin)) : 0;

  const dateLabel = now ? dayLabel(t.y, t.m, t.d) : " ";

  return (
    <>
      <section className="hero" aria-label="Hari ini dan jadwal salat">
        <div className="hero-place">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21s-6-5.4-6-10.5a6 6 0 0 1 12 0C18 15.6 12 21 12 21z" />
            <circle cx="12" cy="10.5" r="2" />
          </svg>
          <span className="hero-place-name">{city ? placeName(city) : " "}</span>
          {city?.gps && <span className="hero-place-sub">{placeDetail(city)}</span>}
          <button type="button" className="change-btn" disabled={!city} onClick={() => setChanging(true)} data-tip="Ganti lokasi atau pakai GPS">
            Ganti
          </button>
        </div>
        <p className="hero-date">{dateLabel}</p>

        <p className="clock" aria-live="off">
          {now ? `${pad(t.h)}:${pad(t.min)}` : "--:--"}
          <span className="clock-sec">{now ? `:${pad(t.s)}` : ""}</span>
          <span className="clock-zone">{zone.label}</span>
        </p>

        <p className="hero-next">
          {next ? (
            <>
              <strong>
                Menuju {next.label}
                {next.tomorrow ? " besok" : ""}:
              </strong>
              {` ${until(left)}`}
            </>
          ) : (
            " "
          )}
        </p>

        <div className="hero-times">
          <div className="imsak">
            <span>Imsak</span>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l2.5 2" />
            </svg>
            <strong>{day?.imsak ?? "--:--"}</strong>
          </div>
          {PRAYERS.map((p) => (
            <div key={p.key} className={next && !next.tomorrow && next.key === p.key ? "next" : undefined}>
              <span>{p.label}</span>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {PRAYER_ICON[p.key]}
              </svg>
              <strong>{day ? day[p.key] : "--:--"}</strong>
            </div>
          ))}
        </div>

        <p className="hero-note">
          {day
            ? city?.gps
              ? `Dihitung dari posisi GPS dengan kriteria Kemenag RI (${zone.label}); selisih sekitar 1 menit dari jadwal resmi.`
              : city?.id === "1301" && city.lokasi !== "KOTA JAKARTA"
                ? `Jadwal Kemenag RI untuk seluruh DKI Jakarta (${zone.label})`
                : `Jadwal Kemenag RI · ${city ? pretty(city.lokasi) : ""} (${zone.label})`
            : failed
              ? `${failed} Jadwal akan tampil saat tersambung.`
              : "Memuat jadwal salat…"}
        </p>
      </section>

      {changing && city && (
        <ChangeSheet
          current={cityKey(city)}
          onClose={() => setChanging(false)}
          onPick={(c) => {
            setCity(c);
            setChanging(false);
          }}
        />
      )}
    </>
  );
}
