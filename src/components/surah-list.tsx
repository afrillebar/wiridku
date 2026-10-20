"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Surah } from "@/lib/quran-types";

const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// a surah matches its number, or its name or meaning with spaces, dashes and apostrophes ignored
export function matchSurah(s: Surah, query: string) {
  const q = plain(query);
  return !q || String(s.id) === q || plain(s.name).includes(q) || plain(s.meaning).includes(q);
}

// Searchable list of all surahs for jumping straight to one; opens scrolled to the current surah.
export function SurahList({ surahs, current, onPick }: { surahs: Surah[]; current: number; onPick: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const here = useRef<HTMLLIElement>(null);
  const shown = useMemo(() => surahs.filter((s) => matchSurah(s, query)), [surahs, query]);

  useEffect(() => {
    here.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div className="surah-list">
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari surah, mis. Yasin atau 36" aria-label="Cari surah" autoComplete="off" />
      <ol>
        {shown.map((s) => (
          <li key={s.id} ref={s.id === current ? here : undefined}>
            <button type="button" aria-current={s.id === current ? "true" : undefined} onClick={() => onPick(s.id)}>
              <span className="surah-list-num">{s.id}</span>
              <span className="surah-list-name">
                <strong>{s.name}</strong>
                <small>
                  {s.meaning} · {s.verses} ayat
                </small>
              </span>
              <span className="surah-list-ar" lang="ar" dir="rtl">
                {s.arabic}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {!shown.length && (
        <p className="surah-list-empty" role="status">
          Surah tidak ditemukan.
        </p>
      )}
    </div>
  );
}
