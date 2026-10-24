"use client";

import { useSyncExternalStore } from "react";
import ayahs from "@/lib/daily-ayahs.json";
import { dailyAyahIndex, localDayKey, millisecondsUntilLocalMidnight } from "@/lib/local-day";

// Full verses from Kemenag translation 33, the same resource as lib/quran.ts:
// https://api.quran.com/api/v4/quran/translations/33
// Keep the JSON text verbatim; do not truncate a verse to fit the card.
function subscribeToLocalDay(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  function refresh() {
    onChange();
    clearTimeout(timer);
    timer = setTimeout(refresh, millisecondsUntilLocalMidnight());
  }
  function resume() {
    if (document.visibilityState === "visible") refresh();
  }
  timer = setTimeout(refresh, millisecondsUntilLocalMidnight());
  // Recheck after sleep, back/forward navigation, or a timezone/clock change.
  const clockCheck = setInterval(refresh, 60_000);
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  return () => {
    clearTimeout(timer);
    clearInterval(clockCheck);
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("pageshow", refresh);
  };
}

const clientDay = () => localDayKey();
const serverDay = () => "";

export function useAyahOfDay() {
  const day = useSyncExternalStore(subscribeToLocalDay, clientDay, serverDay);
  return day ? ayahs[dailyAyahIndex(day, ayahs.length)] : null;
}

export function AyahOfDay() {
  const ayah = useAyahOfDay();
  return (
    <section className="daily-ayah" aria-labelledby="daily-ayah-title" aria-busy={!ayah}>
      <div className="daily-ayah-head">
        <h2 id="daily-ayah-title">Ayat Hari Ini</h2>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v15M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Z" />
        </svg>
      </div>
      {ayah ? (
        <figure className="daily-ayah-content">
          <blockquote><p>{ayah.text}</p></blockquote>
          <figcaption><cite>{ayah.surah}</cite></figcaption>
        </figure>
      ) : (
        <div className="daily-ayah-placeholder" role="status" aria-label="Memuat ayat hari ini">
          <span /><span /><span />
        </div>
      )}
    </section>
  );
}
