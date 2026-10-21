// Masehi, Hijriah and Javanese (pasaran) facts about one calendar day. Shared by the prayer card and the Kalender page.
// The Hijri date is Umm al-Qura from the browser, which can differ by a day from the one Kemenag announces; the pasaran and neptu are plain arithmetic.

export const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const WEEKDAYS = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const HIJRI_MONTHS = ["Muharram", "Safar", "Rabiul Awal", "Rabiul Akhir", "Jumadil Ula", "Jumadil Akhir", "Rajab", "Syakban", "Ramadan", "Syawal", "Zulkaidah", "Zulhijah"];
const PASARAN = ["Legi", "Pahing", "Pon", "Wage", "Kliwon"];
// neptu: Ahad 5, Senin 4, Selasa 3, Rabu 7, Kamis 8, Jumat 6, Sabtu 9; Legi 5, Pahing 9, Pon 7, Wage 4, Kliwon 8
const NEPTU_HARI = [5, 4, 3, 7, 8, 6, 9];
const NEPTU_PASARAN = [5, 9, 7, 4, 8];

const hijriFormat = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });

export type Hijri = { day: number; month: number; year: number };
export type DayInfo = { y: number; m: number; d: number; weekday: number; pasaran: string; neptu: number; hijri: Hijri };

export function dayInfo(y: number, m: number, d: number): DayInfo {
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.getUTCDay();
  // 1 Jan 1970 was a Thursday Wage, pasaran index 3
  // ponytail: the double modulo keeps dates before 1970 (negative day counts) in 0-4
  const p = (((Math.floor(date.getTime() / 864e5) + 3) % 5) + 5) % 5;
  const parts = Object.fromEntries(hijriFormat.formatToParts(date).map((x) => [x.type, Number(x.value)]));
  return { y, m, d, weekday, pasaran: PASARAN[p], neptu: NEPTU_HARI[weekday] + NEPTU_PASARAN[p], hijri: { day: parts.day, month: parts.month, year: parts.year } };
}

// The Hijri years the page can reach (it stops at 1900 and 2100)
export const HIJRI_YEARS = [dayInfo(1900, 1, 1).hijri.year, dayInfo(2100, 12, 31).hijri.year] as const;

// Which Gregorian day has this Hijri date? An estimate from the mean lunar year, then the exact day Umm al-Qura gives.
// Returns null when no such date exists (e.g. day 30 of a 29-day month). Day 0 means "the 1st".
export function fromHijri(year: number, month: number, day: number): { y: number; m: number; d: number } | null {
  // 1 Muharram 1 AH (civil) is day -492148 counted from 1 January 1970
  const guess = Math.round(-492148 + (year - 1) * 354.36707 + (month - 1) * 29.530589 + (day || 1) - 1);
  for (let off = 0; off <= 30; off++) {
    for (const sign of off ? [-1, 1] : [1]) {
      const at = new Date((guess + sign * off) * 864e5);
      const info = dayInfo(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate());
      if (info.hijri.year === year && info.hijri.month === month && info.hijri.day === (day || 1)) return { y: info.y, m: info.m, d: info.d };
    }
  }
  return null;
}

// What the page marks under a date. Sunnah fasting follows the usual rules: Monday and Thursday, and the "white days" (Hijri 13-15).
// No fasting marker in Ramadan (it is obligatory then) and none on the days when fasting is forbidden: 1 Syawal, 10 Zulhijah and the tasyrik days 11-13 Zulhijah.
export type Marker = { kind: "besar" | "jumat" | "bidh" | "puasa"; label: string };

// Islamic holy days by Hijri date [month, day, label]. The government announces the actual dates (sidang isbat), which can differ by a day from this calendar.
const HARI_BESAR: [number, number, string][] = [
  [1, 1, "Tahun Baru Islam"],
  [1, 10, "Hari Asyura"],
  [3, 12, "Maulid Nabi Muhammad SAW"],
  [7, 27, "Isra Mi'raj Nabi Muhammad SAW"],
  [8, 15, "Nisfu Syakban"],
  [9, 1, "Awal Ramadan"],
  [9, 17, "Nuzulul Quran"],
  [10, 1, "Idul Fitri"],
  [12, 9, "Hari Arafah"],
  [12, 10, "Idul Adha"],
  [12, 11, "Hari Tasyrik"],
  [12, 12, "Hari Tasyrik"],
  [12, 13, "Hari Tasyrik"],
];
export function markers(i: DayInfo): Marker[] {
  const { day, month } = i.hijri;
  const noFast = month === 9 || (month === 10 && day === 1) || (month === 12 && day >= 10 && day <= 13);
  const out: Marker[] = [];
  const big = HARI_BESAR.find(([m, d]) => m === month && d === day);
  if (big) out.push({ kind: "besar", label: month === 1 && day === 1 ? `${big[2]} ${i.hijri.year} H` : big[2] });
  if (i.weekday === 5) out.push({ kind: "jumat", label: "Hari Jumat" });
  if (!noFast && day >= 13 && day <= 15) out.push({ kind: "bidh", label: "Sunnah Puasa Ayyamul Bidh" });
  if (!noFast && (i.weekday === 1 || i.weekday === 4)) out.push({ kind: "puasa", label: "Sunnah Puasa Senin-Kamis" });
  return out;
}

export const hijriText = (h: Hijri) => `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}`;

// "Selasa Kliwon, 20 Oktober 2026 / 9 Jumadil Ula 1448"
export function dayLabel(y: number, m: number, d: number) {
  const i = dayInfo(y, m, d);
  return `${WEEKDAYS[i.weekday]} ${i.pasaran}, ${d} ${MONTHS[m - 1]} ${y} / ${hijriText(i.hijri)}`;
}

// The Hijri months a Gregorian month covers: "Rabiul Akhir - Jumadil Ula 1448"
export function hijriRange(y: number, m: number) {
  const a = dayInfo(y, m, 1).hijri;
  const b = dayInfo(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate()).hijri;
  if (a.month === b.month && a.year === b.year) return `${HIJRI_MONTHS[b.month - 1]} ${b.year}`;
  return `${HIJRI_MONTHS[a.month - 1]}${a.year !== b.year ? ` ${a.year}` : ""} - ${HIJRI_MONTHS[b.month - 1]} ${b.year}`;
}
