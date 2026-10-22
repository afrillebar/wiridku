"use client";

import { memo, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { AMBIENTS, type AmbientId } from "@/lib/ambient";
import { clock, paintFill, useAudioClock, type Clip } from "@/lib/audio-clock";
import type { ListenBackground } from "@/lib/content";
import type { Qari, Surah, Verse } from "@/lib/quran-types";
import { QariList } from "./qari-list";
import { SurahList } from "./surah-list";

// null = off, "end" = stop when the surah ends, an object = stop at `at` (Date.now() ms); `min` is the choice that was tapped, so its button can light up
export type Sleep = null | "end" | { at: number; min: number };
const SLEEP_MINUTES = [15, 30, 60];

function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export type ListenShow = { arab: boolean; latin: boolean; arti: boolean };
const SHOW_OPTIONS = [
  { key: "arab", label: "Arab" },
  { key: "latin", label: "Latin" },
  { key: "arti", label: "Terjemahan" },
] as const;

const LsnVerse = memo(function LsnVerse({ v, surah, unit, on, show, onPlay }: { v: Verse; surah: number; unit: string; on: boolean; show: ListenShow; onPlay: (n: number) => void }) {
  return (
    <article id={`dengar-${v.n}`} className={`lsn-verse${on ? " on" : ""}`} aria-current={on ? "true" : undefined}>
      <button type="button" className="lsn-key" onClick={() => onPlay(v.n)} aria-label={`Putar dari ${unit} ${v.n}`}>
        {v.key ?? `${surah}:${v.n}`}
      </button>
      {show.arab && (
        <p className="arabic" dir="rtl" lang="ar">
          {v.arabic}
        </p>
      )}
      {show.latin && v.latin && <p className="lsn-latin">{v.latin}</p>}
      {show.arti && v.arti && <p className="lsn-arti">{v.arti}</p>}
    </article>
  );
});

// counts down once a second, kept apart so the rest of the view does not re-render with it
function SleepLabel({ sleep, end }: { sleep: Sleep; end: string }) {
  const [now, setNow] = useState(() => Date.now());
  const running = typeof sleep === "object" && sleep !== null;
  useEffect(() => {
    if (!running) return;
    // ponytail: first tick right away, otherwise a newly chosen timer shows the time since this label was created until the next second
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [running, sleep]);
  if (sleep === "end") return <>{end}</>;
  if (running) return <>{clock((sleep.at - now) / 1000)}</>;
  return <>Timer</>;
}

// the words that name what is being read: a surah and its verses, or a bacaan and its baris
export type ListenLabels = { part: string; unit: string; audio: string };
const QURAN_LABELS: ListenLabels = { part: "surah", unit: "ayat", audio: "murotal" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Props = {
  // labels and qariPick are for readings other than the Qur'an: no reciter to choose, and other words for surah and ayat
  labels?: ListenLabels;
  qariPick?: boolean;
  // when the sound is a stretch of a longer file, the bar and the times cover that stretch only, and the value onSeek gets counts from its start
  clipRef?: RefObject<Clip | null>;
  surah: Surah;
  surahs: Surah[];
  qaris: Qari[];
  qari: number;
  onQari: (id: number) => void;
  verses: Verse[];
  qariName: string;
  active: number;
  playing: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
  status: string;
  canPlay: boolean;
  canStep: boolean;
  show: ListenShow;
  backgrounds: ListenBackground[];
  bg: string | null;
  ambient: AmbientId | null;
  ambientVol: number;
  autoNext: boolean;
  prevName: string | null;
  nextName: string | null;
  sleep: Sleep;
  onSurah: (id: number) => void;
  onPrevSurah: () => void;
  onNextSurah: () => void;
  onToggle: () => void;
  onStep: (d: -1 | 1) => void;
  onSeek: (sec: number) => void;
  onPlayFrom: (n: number) => void;
  onShow: (patch: Partial<ListenShow>) => void;
  onBg: (id: string) => void;
  onAmbient: (id: AmbientId | null) => void;
  onAmbientVol: (v: number) => void;
  onAutoNext: (on: boolean) => void;
  onSleep: (s: Sleep) => void;
  onClose: () => void;
};

export function ListenView(p: Props) {
  const L = p.labels ?? QURAN_LABELS;
  const [sheet, setSheet] = useState<null | "suara" | "timer" | "tampilan" | "surah" | "qari">(null);
  const { rangeRef, nowRef, lastRef, drag } = useAudioClock(p.audioRef, p.playing, "left", p.clipRef);
  // the last text still shown cannot be hidden, or the screen would be empty
  const shown = SHOW_OPTIONS.filter((o) => p.show[o.key]).length;
  const closeBtn = useRef<HTMLButtonElement>(null);
  const picked = p.bg === "none" ? null : (p.backgrounds.find((b) => b.id === p.bg) ?? p.backgrounds[0] ?? null);
  const { onClose, active, playing } = p;

  useEffect(() => {
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (sheet) setSheet(null);
      else onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [sheet, onClose]);

  // the first jump lands at once, and so does a long one; only a step to a nearby verse glides
  const jumped = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scroller.current;
    const el = active ? document.getElementById(`dengar-${active}`) : null;
    if (!box || !el) return;
    const far = Math.abs(el.offsetTop + el.offsetHeight / 2 - (box.scrollTop + box.clientHeight / 2)) > box.clientHeight * 1.5;
    const smooth = jumped.current && !far && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    jumped.current = true;
  }, [active]);

  // keep the screen on while the recitation plays
  useEffect(() => {
    if (!playing || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    navigator.wakeLock
      .request("screen")
      .then((l) => {
        if (gone) l.release().catch(() => {});
        else lock = l;
      })
      .catch(() => {});
    return () => {
      gone = true;
      lock?.release().catch(() => {});
    };
  }, [playing]);

  const ambientLabel = AMBIENTS.find((a) => a.id === p.ambient)?.label ?? "Suara latar";

  return (
    <div className="lsn" role="dialog" aria-modal="true" aria-label={`Mode dengar, ${L.part} ${p.surah.name}`}>
      <div className={`lsn-bg${picked ? "" : " plain"}`} style={picked ? { backgroundImage: `url("${picked.url}")` } : undefined} aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {picked && <img className="lsn-bg-img" src={picked.url} alt="" aria-hidden="true" />}

      <header className="lsn-top">
        <button ref={closeBtn} type="button" className="lsn-round" onClick={p.onClose} aria-label="Tutup mode dengar">
          <Icon>
            <path d="m6 9 6 6 6-6" />
          </Icon>
        </button>
        <button type="button" className={`lsn-chip${p.ambient ? " on" : ""}`} onClick={() => setSheet("suara")} aria-haspopup="dialog">
          <Icon size={18}>
            <path d="M7 15a4 4 0 1 1 .9-7.9A5 5 0 0 1 17.6 9 3.5 3.5 0 0 1 17 16H7z" />
            <path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2" />
          </Icon>
          {ambientLabel}
        </button>
        <span className="lsn-gap" />
        <button type="button" className={`lsn-chip${p.sleep ? " on" : ""}`} onClick={() => setSheet("timer")} aria-haspopup="dialog" aria-label="Timer tidur">
          <Icon size={18}>
            <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
          </Icon>
          <SleepLabel sleep={p.sleep} end={`Akhir ${L.part}`} />
        </button>
        <button type="button" className="lsn-round" onClick={() => setSheet("tampilan")} aria-haspopup="dialog" aria-label="Pengaturan tampilan">
          <Icon>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </Icon>
        </button>
      </header>

      <div className="lsn-stage">
        <div ref={scroller} className="lsn-verses">
          {p.verses.map((v) => (
            <LsnVerse key={v.n} v={v} surah={p.surah.id} unit={L.unit} on={p.active === v.n} show={p.show} onPlay={p.onPlayFrom} />
          ))}
        </div>
      </div>

      <div className="lsn-player">
        <div className="lsn-now">
          <div className="lsn-title">
            <button type="button" className="lsn-title-surah" onClick={() => setSheet("surah")} aria-haspopup="dialog" aria-label={`${p.surah.id}. ${p.surah.name}, pilih ${L.part} lain`}>
              {p.surah.id}. {p.surah.name} <span lang="ar">{p.surah.arabic}</span>
            </button>
            {p.qariPick === false ? (
              <span className="lsn-title-qari">
                <span>{p.qariName}</span>
              </span>
            ) : (
              <button type="button" className="lsn-title-qari" onClick={() => setSheet("qari")} aria-haspopup="dialog" aria-label={`Qari ${p.qariName}, ganti qari`}>
                <span>{p.qariName}</span>
                <Icon size={14}>
                  <path d="m6 9 6 6 6-6" />
                </Icon>
              </button>
            )}
            <span className="lsn-title-status">{p.status}</span>
          </div>
          <button type="button" className="lsn-list" onClick={() => setSheet("surah")} aria-haspopup="dialog">
            <Icon size={18}>
              <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
            </Icon>
            {cap(L.part)}
          </button>
        </div>

        <input
          ref={rangeRef}
          type="range"
          className="lsn-seek"
          min={0}
          max={0}
          step="any"
          defaultValue={0}
          onChange={(e) => {
            paintFill(e.currentTarget);
            p.onSeek(Number(e.currentTarget.value));
          }}
          {...drag}
          aria-label={`Posisi ${L.audio}`}
        />
        <div className="lsn-times">
          <span ref={nowRef}>0:00</span>
          <span ref={lastRef}>-0:00</span>
        </div>

        <div className="lsn-btns">
          <button type="button" className="lsn-skip" onClick={p.onPrevSurah} disabled={!p.prevName} aria-label={p.prevName ? `${cap(L.part)} sebelumnya, ${p.prevName}` : `${cap(L.part)} sebelumnya`}>
            <Icon size={22}>
              <path d="M6 5v14" strokeWidth="2.4" />
              <path d="M19 5.5 8.5 12 19 18.5z" fill="currentColor" />
            </Icon>
            <small>{cap(L.part)}</small>
          </button>
          <button type="button" className="lsn-skip" onClick={() => p.onStep(-1)} disabled={!p.canStep} aria-label={`${cap(L.unit)} sebelumnya`}>
            <Icon size={22}>
              <path d="M11.5 6 4 12l7.5 6zM20.5 6 13 12l7.5 6z" fill="currentColor" />
            </Icon>
            <small>{cap(L.unit)}</small>
          </button>
          <button type="button" className="lsn-play" onClick={p.onToggle} disabled={!p.canPlay} aria-label={p.playing ? "Jeda" : "Putar"}>
            <Icon size={30}>{p.playing ? <path d="M8 5v14M16 5v14" strokeWidth="3.2" /> : <path d="M8 4.5v15l12-7.5z" fill="currentColor" />}</Icon>
          </button>
          <button type="button" className="lsn-skip" onClick={() => p.onStep(1)} disabled={!p.canStep} aria-label={`${cap(L.unit)} berikutnya`}>
            <Icon size={22}>
              <path d="M12.5 6 20 12l-7.5 6zM3.5 6 11 12l-7.5 6z" fill="currentColor" />
            </Icon>
            <small>{cap(L.unit)}</small>
          </button>
          <button type="button" className="lsn-skip" onClick={p.onNextSurah} disabled={!p.nextName} aria-label={p.nextName ? `${cap(L.part)} berikutnya, ${p.nextName}` : `${cap(L.part)} berikutnya`}>
            <Icon size={22}>
              <path d="M18 5v14" strokeWidth="2.4" />
              <path d="M5 5.5 15.5 12 5 18.5z" fill="currentColor" />
            </Icon>
            <small>{cap(L.part)}</small>
          </button>
        </div>
      </div>

      {sheet && (
        <div className="lsn-sheet-wrap" onClick={() => setSheet(null)}>
          <section className="lsn-sheet" role="dialog" aria-label={{ suara: "Suara latar", timer: "Timer tidur", tampilan: "Pengaturan tampilan", surah: `Pilih ${L.part}`, qari: "Pilih qari" }[sheet]} onClick={(e) => e.stopPropagation()}>
            <span className="lsn-grip" aria-hidden="true" />
            {sheet === "suara" && (
              <>
                <h2>Suara latar</h2>
                <div className="lsn-options" role="group" aria-label="Suara latar">
                  <button type="button" aria-pressed={!p.ambient} onClick={() => p.onAmbient(null)}>
                    Mati
                  </button>
                  {AMBIENTS.map((a) => (
                    <button key={a.id} type="button" aria-pressed={p.ambient === a.id} onClick={() => p.onAmbient(a.id)}>
                      {a.label}
                    </button>
                  ))}
                </div>
                <label className="lsn-vol">
                  <span>Volume</span>
                  <input type="range" min={0} max={100} value={Math.round(p.ambientVol * 100)} onChange={(e) => p.onAmbientVol(Number(e.target.value) / 100)} disabled={!p.ambient} />
                </label>
                <p className="lsn-hint">Suara latar ikut berhenti saat {L.audio} dijeda.</p>
              </>
            )}
            {sheet === "timer" && (
              <>
                <h2>Timer tidur</h2>
                <div className="lsn-options" role="group" aria-label="Berhenti setelah">
                  <button type="button" aria-pressed={!p.sleep} onClick={() => p.onSleep(null)}>
                    Mati
                  </button>
                  {SLEEP_MINUTES.map((m) => (
                    <button key={m} type="button" aria-pressed={typeof p.sleep === "object" && p.sleep !== null && p.sleep.min === m} onClick={() => p.onSleep({ at: Date.now() + m * 60000, min: m })}>
                      {m} menit
                    </button>
                  ))}
                  <button type="button" aria-pressed={p.sleep === "end"} onClick={() => p.onSleep("end")}>
                    Akhir {L.part}
                  </button>
                </div>
                {typeof p.sleep === "object" && p.sleep !== null && (
                  <p className="lsn-hint">
                    Berhenti dalam <SleepLabel sleep={p.sleep} end={`Akhir ${L.part}`} />.
                  </p>
                )}
                <label className="lsn-check">
                  <input type="checkbox" checked={p.autoNext} onChange={(e) => p.onAutoNext(e.target.checked)} disabled={!p.nextName} />
                  Lanjut otomatis ke {L.part} berikutnya
                </label>
              </>
            )}
            {sheet === "surah" && (
              <>
                <h2>Pilih {L.part}</h2>
                <SurahList surahs={p.surahs} current={p.surah.id} onPick={p.onSurah} unit={L.unit} noun={L.part} />
              </>
            )}
            {sheet === "qari" && (
              <>
                <h2>Pilih qari</h2>
                <QariList
                  qaris={p.qaris}
                  current={p.qari}
                  onPick={(id) => {
                    setSheet(null);
                    p.onQari(id);
                  }}
                />
                <p className="lsn-hint">Bacaan lanjut dari ayat yang sama.</p>
              </>
            )}
            {sheet === "tampilan" && (
              <>
                <h2>Tampilkan</h2>
                <div className="lsn-options" role="group" aria-label="Teks yang ditampilkan">
                  {SHOW_OPTIONS.map((o) => (
                    <button key={o.key} type="button" aria-pressed={p.show[o.key]} onClick={() => (p.show[o.key] && shown === 1 ? undefined : p.onShow({ [o.key]: !p.show[o.key] }))}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="lsn-hint">Hanya untuk mode dengar. Minimal satu tetap tampil.</p>
                <h2 className="lsn-sub">Latar</h2>
                <div className="lsn-bgs" role="group" aria-label="Latar">
                  <button type="button" className="plain" aria-pressed={!picked} onClick={() => p.onBg("none")}>
                    <span>Polos</span>
                  </button>
                  {p.backgrounds.map((b) => (
                    <button key={b.id} type="button" aria-pressed={picked?.id === b.id} onClick={() => p.onBg(b.id)} style={{ backgroundImage: `url("${b.url}")` }}>
                      <span>{b.title}</span>
                    </button>
                  ))}
                </div>
                {picked?.credit && <p className="lsn-hint">{picked.credit}</p>}
                {!p.backgrounds.length && <p className="lsn-hint">Belum ada gambar latar dari admin.</p>}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
