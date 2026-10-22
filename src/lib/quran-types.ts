// Shapes shared by the Al-Qur'an pages and the browser player.
export const SURAH_COUNT = 114;
// Mishari Rashid al-'Afasy
export const DEFAULT_QARI = 7;

export type Surah = { id: number; name: string; arabic: string; meaning: string; place: "makkah" | "madinah"; verses: number; bismillah: boolean };
// key: how the listening view labels the verse when it is not "surah:n" (other readings than a surah)
export type Verse = { n: number; arabic: string; latin: string; arti: string; key?: string };
export type Qari = { id: number; name: string };
// timings[i] = [start, end] of verse i + 1 inside the file, in milliseconds
export type Recitation = { url: string; timings: [number, number][] };
