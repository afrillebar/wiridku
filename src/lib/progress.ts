import { useCallback, useMemo, useSyncExternalStore } from "react";

const PROGRESS_KEY = "wirid_progress_v1";
const STREAK_KEY = "wirid_streak_v1";
const EVENT = "wirid-storage";

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
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
};

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
