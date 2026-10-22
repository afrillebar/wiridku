"use client";

import { useState } from "react";
import { LISTEN_GOALS, useListenGoal } from "@/lib/progress";

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// compact sits on the surah page and shows nothing until a goal is set
export function ListenGoalCard({ compact = false }: { compact?: boolean }) {
  const { goal, sec, streak, met, week, setGoal } = useListenGoal();
  const [open, setOpen] = useState(false);
  if (compact && !goal) return null;
  const min = Math.floor(sec / 60);
  const pct = goal ? Math.min(100, (sec / (goal * 60)) * 100) : 0;
  // past days are judged by today's goal; the log keeps seconds, not the goal each day had
  const hits = week.map((d) => goal > 0 && d.sec >= goal * 60);

  return (
    <>
      <button type="button" className={`lgoal${compact ? " compact" : ""}${met ? " met" : ""}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {goal ? (
          <>
            <span className="lgoal-text">
              <small>{met ? "Target hari ini tercapai" : "Target dengar hari ini"}</small>
              <strong>
                {min} / {goal} menit
              </strong>
            </span>
            <span className="streak" aria-label={`Beruntun ${streak} hari`}>
              🔥 {streak} hari
            </span>
            <span className="lgoal-bar" role="progressbar" aria-label="Menit didengar hari ini" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(goal, min)}>
              <span style={{ width: `${pct}%` }} />
            </span>
            {!compact && week.length > 0 && (
              <span className="lgoal-week" role="img" aria-label={`Tujuh hari terakhir: ${hits.filter(Boolean).length} hari tercapai`}>
                {week.map((d, i) => (
                  <span key={d.date} className={`${hits[i] ? "hit" : ""}${i === 6 ? " now" : ""}`}>
                    <span>{hits[i] ? "✓" : ""}</span>
                    <small>{WEEKDAYS[d.weekday]}</small>
                  </span>
                ))}
              </span>
            )}
          </>
        ) : (
          <span className="lgoal-text">
            <small>Target dengar harian</small>
            <strong>Atur target dan jaga streak</strong>
          </span>
        )}
      </button>

      {open && (
        <div className="qrn-sheet-wrap" onClick={() => setOpen(false)}>
          <section className="qrn-sheet" role="dialog" aria-modal="true" aria-label="Target dengar harian" onClick={(e) => e.stopPropagation()}>
            <div className="qrn-sheet-head">
              <h2>Target dengar harian</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup">
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <p className="lgoal-hint">Dengarkan murotal minimal sekian menit sehari. Tiap hari yang mencapai target menambah streak; terlewat sehari, streak mulai lagi dari awal.</p>
            <div className="doa-cats lgoal-opts" role="group" aria-label="Menit per hari">
              <button type="button" aria-pressed={!goal} onClick={() => setGoal(0)}>
                Mati
              </button>
              {LISTEN_GOALS.map((m) => (
                <button key={m} type="button" aria-pressed={goal === m} onClick={() => setGoal(m)}>
                  {m} menit
                </button>
              ))}
            </div>
            {goal > 0 && (
              <p className="lgoal-hint">
                Hari ini {min} menit didengar{streak > 0 ? ` · beruntun ${streak} hari` : ""}.
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
