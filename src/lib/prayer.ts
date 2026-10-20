// Prayer schedule shared by the /api/jadwal routes and the home card.
// Times come from Kemenag RI (Bimas Islam) per kabupaten/kota, through api.myquran.com, in the city's own local time.

export const PRAYERS = [
  { key: "subuh", label: "Subuh" },
  { key: "dzuhur", label: "Dzuhur" },
  { key: "ashar", label: "Asar" },
  { key: "maghrib", label: "Magrib" },
  { key: "isya", label: "Isya" },
] as const;

export type PrayerKey = (typeof PRAYERS)[number]["key"];
export type DaySchedule = { date: string; imsak: string; terbit: string } & Record<PrayerKey, string>;
// what the screen needs of a day; both the Kemenag tables and the GPS calculation provide it
export type DayTimes = { date: string; imsak?: string } & Record<PrayerKey, string>;
export type MonthSchedule = { id: string; lokasi: string; daerah: string; jadwal: DaySchedule[] };
// gps: set when the place is the device's own position; its times are then calculated, not looked up
export type City = { id: string; lokasi: string; daerah?: string; gps?: { lat: number; lon: number; tz: number } };

export const ZONES = [
  { label: "WIB", offset: 7, tz: "Asia/Jakarta" },
  { label: "WITA", offset: 8, tz: "Asia/Makassar" },
  { label: "WIT", offset: 9, tz: "Asia/Jayapura" },
] as const;
export type Zone = (typeof ZONES)[number];

// ponytail: Indonesia has no daylight saving, so the zone follows from the province alone
export function zoneOf(daerah: string): Zone {
  const d = daerah.toUpperCase();
  if (/MALUKU|PAPUA/.test(d)) return ZONES[2];
  if (/BALI|NUSA TENGGARA|NTB|NTT|SULAWESI|GORONTALO|KALIMANTAN (SELATAN|TIMUR|UTARA)/.test(d)) return ZONES[1];
  return ZONES[0];
}

export const isCityId = (v: string | null): v is string => !!v && /^\d{3,4}$/.test(v);

export const zoneByOffset = (offset: number): Zone => ZONES.find((z) => z.offset === offset) ?? ZONES[0];

// roughly the land and sea of Indonesia; GPS outside this box gets an honest "not available" instead of Kemenag times
export const inIndonesia = (lat: number, lon: number) => lat >= -11.5 && lat <= 6.5 && lon >= 94.5 && lon <= 141.5;

// ponytail: the device's own zone settles the border cases (Bali vs Banyuwangi); the longitude is only the fallback
export function zoneOffsetFor(lon: number, deviceZone: string): number {
  const byDevice = ZONES.find((z) => z.tz === deviceZone || (z.label === "WIB" && deviceZone === "Asia/Pontianak"));
  if (byDevice) return byDevice.offset;
  return lon < 115 ? 7 : lon < 127 ? 8 : 9;
}
