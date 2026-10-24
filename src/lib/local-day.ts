// Calendar dates use the visitor's local timezone; UTC is only used to count
// calendar days, so DST never repeats or skips an entry in the rotation.
export function localDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dailyAyahIndex(day: string, count: number): number {
  if (!Number.isInteger(count) || count < 1) throw new RangeError("The verse collection must not be empty");
  const [year, month, date] = day.split("-").map(Number);
  const ordinal = Math.floor(Date.UTC(year, month - 1, date) / 86_400_000);
  if (!Number.isFinite(ordinal)) throw new RangeError("Invalid local date");
  return ((ordinal % count) + count) % count;
}

export function millisecondsUntilLocalMidnight(now = new Date()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime() + 100;
}
