"use client";

import { useEffect, useRef } from "react";
import type { Qari } from "@/lib/quran-types";

// "Mishari Rashid al-`Afasy (Mujawwad)" -> "MA": first and last word of the name, style left out
function initials(name: string) {
  const words = name
    .replace(/\(.*\)/, "")
    .split(/[\s-]+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(al|as|ash|ad|ar|ah|an)$/i.test(w));
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

// a style such as "(Mujawwad)" goes on its own line under the name
const split = (name: string) => {
  const m = /^(.*?)\s*\((.+)\)$/.exec(name);
  return m ? { name: m[1], style: m[2] } : { name, style: "Murattal" };
};

// List of reciters to switch to; opens scrolled to the current one.
export function QariList({ qaris, current, onPick }: { qaris: Qari[]; current: number; onPick: (id: number) => void }) {
  const here = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const row = here.current;
    const list = row?.closest("ol");
    if (row && list) list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top - (list.clientHeight - row.clientHeight) / 2;
  }, []);

  return (
    <ol className="qari-list">
      {qaris.map((q) => {
        const { name, style } = split(q.name);
        return (
          <li key={q.id} ref={q.id === current ? here : undefined}>
            <button type="button" aria-current={q.id === current ? "true" : undefined} onClick={() => onPick(q.id)}>
              <span className="qari-list-avatar" aria-hidden="true">
                {initials(q.name)}
              </span>
              <span className="qari-list-name">
                <strong>{name}</strong>
                <small>{style}</small>
              </span>
              {q.id === current && <span className="qari-list-now">Diputar</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
