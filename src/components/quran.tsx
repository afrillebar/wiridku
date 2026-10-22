"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Ambient, isAmbient, type AmbientId } from "@/lib/ambient";
import { clock, paintFill, useAudioClock } from "@/lib/audio-clock";
import type { ListenBackground } from "@/lib/content";
import { addListenSeconds, readQuranPlace, useQuranPlace, useQuranPrefs, useTextPrefs, writeQuranPlace } from "@/lib/progress";
import { DEFAULT_QARI, type Qari, type Recitation, type Surah, type Verse } from "@/lib/quran-types";
import { ListenGoalCard } from "./listen-goal";
import { ListenView, type Sleep } from "./quran-listen";
import { QariList } from "./qari-list";
import { SurahList, matchSurah } from "./surah-list";

// set before moving to another surah from the player: whether it should start playing and reopen the listening view
const HANDOFF_KEY = "wirid_quran_handoff";

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="cal-back" aria-label={label} data-tip={label} data-tip-align="start">
      <Icon>
        <path d="M15 5l-7 7 7 7" />
      </Icon>
    </Link>
  );
}

const placeLabel = (p: Surah["place"]) => (p === "makkah" ? "Makkiyah" : "Madaniyah");

// the verse playing at ms is the last one that has started; 0 before the first verse (e.g. the opening isti'adhah)
function ayahAt(timings: [number, number][], ms: number) {
  let lo = 0;
  let hi = timings.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timings[mid][0] <= ms) {
      found = mid + 1;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

const textVars = (t: { arab: number; latin: number; arti: number }) => ({ "--ar-size": `${t.arab}px`, "--latin-size": `${t.latin}px`, "--arti-size": `${t.arti}px` }) as CSSProperties;

export function QuranIndex({ surahs }: { surahs: Surah[] }) {
  const [query, setQuery] = useState("");
  const place = useQuranPlace();
  const last = place ? surahs.find((s) => s.id === place.surah) : undefined;
  const shown = useMemo(() => surahs.filter((s) => matchSurah(s, query)), [surahs, query]);

  return (
    <div className="qrn">
      <header className="cal-head">
        <BackLink href="/" label="Kembali ke Beranda" />
        <div>
          <h1>Al-Qur&apos;an</h1>
          <p>
            <span>{surahs.length} surah · murotal dan terjemah Kemenag</span>
          </p>
        </div>
      </header>

      <ListenGoalCard />

      {last && place && (
        <Link className="qrn-resume" href={`/alquran/${last.id}`}>
          <span>
            <small>Terakhir didengar</small>
            <strong>{last.name}</strong>
            <span>
              Ayat {place.ayah} · {clock(place.t)}
            </span>
          </span>
          <span className="qrn-resume-go">Lanjutkan</span>
        </Link>
      )}
      <div className="doa-search">
        <Icon size={18}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </Icon>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari surah, mis. Al-Kahf, 36, gua" aria-label="Cari surah" autoComplete="off" />
      </div>

      <ol className="qrn-list">
        {shown.map((s) => (
          <li key={s.id}>
            <Link href={`/alquran/${s.id}`} className="qrn-row">
              <span className="qrn-num">{s.id}</span>
              <span className="qrn-name">
                <strong>{s.name}</strong>
                <span>
                  {s.meaning} · {s.verses} ayat · {placeLabel(s.place)}
                </span>
              </span>
              <span className="qrn-ar" lang="ar" dir="rtl">
                {s.arabic}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {!shown.length && (
        <p className="doa-empty" role="status">
          Surah tidak ditemukan. Coba nama lain atau nomor surah.
        </p>
      )}

      <p className="doa-note-foot">Teks Utsmani, terjemah Kementerian Agama RI, dan murotal dari Quran.com. Bacaan latin dari equran.id.</p>
    </div>
  );
}

type VerseRowProps = { v: Verse; on: boolean; showLatin: boolean; showArti: boolean; canPlay: boolean; onPlay: (n: number) => void };

// memo: the player re-renders several times a second, the verse list only when the highlighted verse changes
const VerseRow = memo(function VerseRow({ v, on, showLatin, showArti, canPlay, onPlay }: VerseRowProps) {
  return (
    <article id={`ayat-${v.n}`} className={`qrn-ayah${on ? " on" : ""}`} aria-current={on ? "true" : undefined}>
      <div className="qrn-ayah-head">
        <span className="qrn-num">{v.n}</span>
        <button type="button" className="qrn-ayah-play" onClick={() => onPlay(v.n)} disabled={!canPlay} aria-label={`Putar dari ayat ${v.n}`} data-tip="Putar dari sini" data-tip-align="end">
          <Icon size={16}>
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </Icon>
        </button>
      </div>
      <p className="arabic" dir="rtl" lang="ar">
        {v.arabic}
      </p>
      {showLatin && v.latin && <p className="latin">{v.latin}</p>}
      {showArti && v.arti && <p className="arti">{v.arti}</p>}
    </article>
  );
});

type Pending = { t?: number; ayah?: number; play: boolean };

export function QuranReader({ surah, surahs, verses, qaris, backgrounds }: { surah: Surah; surahs: Surah[]; verses: Verse[]; qaris: Qari[]; backgrounds: ListenBackground[] }) {
  const router = useRouter();
  const prev = surahs[surah.id - 2] ?? null;
  const next = surahs[surah.id] ?? null;
  const [picking, setPicking] = useState<null | "surah" | "qari">(null);
  const text = useTextPrefs();
  const fallbackQari = qaris.some((q) => q.id === DEFAULT_QARI) ? DEFAULT_QARI : (qaris[0]?.id ?? DEFAULT_QARI);
  const prefs = useQuranPrefs(fallbackQari);
  const qari = qaris.some((q) => q.id === prefs.qari) ? prefs.qari : fallbackQari;
  const qariName = qaris.find((q) => q.id === qari)?.name ?? "";

  // undefined while loading, null when it failed
  const key = `${qari}:${surah.id}`;
  const [loaded, setLoaded] = useState<{ key: string; data: Recitation | null } | null>(null);
  const recitation = loaded?.key === key ? loaded.data : undefined;
  // sync needs one timing per verse; anything else is played without highlighting
  const timings = recitation && recitation.timings.length === verses.length ? recitation.timings : null;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const pending = useRef<Pending | null>(null);
  const resumed = useRef(false);
  const lastSave = useRef(0);
  // when the stretch of playing not yet added to the daily listening time began; 0 while paused
  const heardFrom = useRef(0);
  const [listening, setListening] = useState(false);
  const { rangeRef, nowRef, lastRef, drag } = useAudioClock(audioRef, playing, "total");
  const [sleep, setSleep] = useState<Sleep>(null);
  const ambient = useRef<Ambient | null>(null);
  const ambientId: AmbientId | null = isAmbient(prefs.ambient) ? prefs.ambient : null;
  // one object per choice, so the memoised verse rows skip the player's frequent re-renders
  const listenShow = useMemo(() => ({ arab: prefs.lsnArab, latin: prefs.lsnLatin, arti: prefs.lsnArti }), [prefs.lsnArab, prefs.lsnLatin, prefs.lsnArti]);

  // arriving from another surah's player: start from the top if it was playing, and reopen the listening view if it was open
  useEffect(() => {
    let handoff: { surah?: number; listen?: boolean; play?: boolean; sleep?: Sleep } | null = null;
    try {
      handoff = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) ?? "null");
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch {}
    if (handoff?.surah !== surah.id) return;
    if (handoff.play) pending.current = { t: 0, play: true };
    const listen = !!handoff.listen;
    const keep = typeof handoff.sleep === "object" && handoff.sleep !== null && handoff.sleep.at > Date.now() ? handoff.sleep : null;
    const t = setTimeout(() => {
      setListening(listen);
      if (keep) setSleep(keep);
    }, 0);
    return () => clearTimeout(t);
  }, [surah.id]);

  // the background sound keeps the recitation company: it plays only while the recitation plays
  useEffect(() => {
    if (!ambientId || !playing) {
      ambient.current?.stop();
      return;
    }
    ambient.current ??= new Ambient();
    ambient.current.play(ambientId, prefs.ambientVol);
  }, [ambientId, playing, prefs.ambientVol]);

  useEffect(() => () => ambient.current?.close(), []);

  // ponytail: Next keeps this page mounted but hidden after navigating away; the recitation must not play on with nothing to stop it
  useLayoutEffect(() => {
    const a = audioRef.current;
    return () => a?.pause();
  }, []);

  useEffect(() => {
    if (typeof sleep !== "object" || sleep === null) return;
    const id = setTimeout(() => {
      audioRef.current?.pause();
      setSleep(null);
    }, Math.max(0, sleep.at - Date.now()));
    return () => clearTimeout(id);
  }, [sleep]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/quran/audio?qari=${qari}&surah=${surah.id}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Recitation>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => setLoaded({ key, data }))
      .catch(() => {
        if (!ctrl.signal.aborted) setLoaded({ key, data: null });
      });
    return () => ctrl.abort();
  }, [key, qari, surah.id]);

  const syncAyah = useCallback(
    (sec: number) => {
      const n = timings ? ayahAt(timings, sec * 1000) : 0;
      if (n !== activeRef.current) {
        activeRef.current = n;
        setActive(n);
      }
    },
    [timings],
  );

  const save = useCallback(() => {
    const a = audioRef.current;
    if (!a || !a.currentTime) return;
    writeQuranPlace({ surah: surah.id, qari, t: Math.floor(a.currentTime), ayah: Math.max(1, activeRef.current) });
    lastSave.current = Date.now();
  }, [surah.id, qari]);

  // capped, so a phone that slept mid-play does not count the hours it was asleep
  const logHeard = useCallback(() => {
    if (!heardFrom.current) return;
    const now = Date.now();
    addListenSeconds(Math.min(now - heardFrom.current, 60000) / 1000);
    heardFrom.current = now;
  }, []);

  useEffect(() => {
    if (!playing) return;
    heardFrom.current = Date.now();
    return () => {
      logHeard();
      heardFrom.current = 0;
    };
  }, [playing, logHeard]);

  // the highlight follows every frame while playing; timeupdate alone lags up to a quarter second
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      if (audioRef.current) syncAyah(audioRef.current.currentTime);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, syncAyah]);

  // not while the listening view covers the page: it scrolls its own list, and this one would scroll for nothing
  useEffect(() => {
    if (!prefs.follow || !active || listening) return;
    const el = document.getElementById(`ayat-${active}`);
    if (!el) return;
    // a long jump lands at once; only a step to a nearby verse glides
    const far = Math.abs(el.getBoundingClientRect().top + el.offsetHeight / 2 - innerHeight / 2) > innerHeight * 1.5;
    const smooth = !far && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
  }, [active, prefs.follow, listening]);

  // closing the tab or switching apps mid-surah still keeps the place
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState !== "hidden") return;
      save();
      logHeard();
    };
    const leave = () => {
      save();
      logHeard();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
    };
  }, [save, logHeard]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${surah.name} (${surah.meaning})`,
      artist: qariName,
      album: "Al-Qur'an · Wiridku",
      artwork: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    });
  }, [surah.name, surah.meaning, qariName]);

  const seek = useCallback(
    (sec: number, play: boolean) => {
      const a = audioRef.current;
      if (!a) return;
      if (a.readyState < 1) {
        pending.current = { t: sec, play };
        return;
      }
      a.currentTime = sec;
      syncAyah(sec);
      if (play) a.play().catch(() => {});
    },
    [syncAyah],
  );

  const playFrom = useCallback(
    (n: number) => {
      if (timings) seek(timings[n - 1][0] / 1000, true);
    },
    [timings, seek],
  );

  const onMeta = () => {
    const a = audioRef.current;
    if (!a) return;
    let target = pending.current;
    pending.current = null;
    if (!target && !resumed.current) {
      const saved = readQuranPlace();
      if (saved?.surah === surah.id && saved.qari === qari && saved.t > 0) target = { t: saved.t, play: false };
    }
    resumed.current = true;
    if (!target) return;
    const sec = target.t ?? (target.ayah && timings ? timings[target.ayah - 1][0] / 1000 : 0);
    a.currentTime = sec;
    syncAyah(sec);
    if (target.play) a.play().catch(() => {});
  };

  const onTime = () => {
    const a = audioRef.current;
    if (!a) return;
    syncAyah(a.currentTime);
    if (!a.paused && Date.now() - lastSave.current > 5000) save();
    if (heardFrom.current && Date.now() - heardFrom.current > 15000) logHeard();
  };

  const onEnded = () => {
    setPlaying(false);
    // a finished surah sends "Lanjutkan" to the start of the next one
    if (next) writeQuranPlace({ surah: next.id, qari, t: 0, ayah: 1 });
    else writeQuranPlace({ surah: surah.id, qari, t: 0, ayah: 1 });
    if (sleep === "end") {
      setSleep(null);
      return;
    }
    if (next && prefs.autoNext) goTo(next.id, listening, true);
  };

  const goTo = (id: number, listen: boolean, play: boolean) => {
    setPicking(null);
    if (id === surah.id) return;
    save();
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ surah: id, listen, play, sleep }));
    } catch {}
    router.push(`/alquran/${id}`);
  };

  const changeQari = (id: number) => {
    setPicking(null);
    if (id === qari) return;
    const a = audioRef.current;
    save();
    // the same verse sits at a different second for another reciter, so carry the verse, not the time
    pending.current = { ayah: activeRef.current || undefined, play: !!a && !a.paused };
    setPlaying(false);
    prefs.set({ qari: id });
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !recitation) return;
    if (a.paused) {
      // iOS only lets Web Audio make sound when it is started from a tap
      if (ambientId) (ambient.current ??= new Ambient()).unlock();
      a.play().catch(() => {});
    } else a.pause();
  };

  const closeListen = useCallback(() => setListening(false), []);

  const pickAmbient = (id: AmbientId | null) => {
    if (id) (ambient.current ??= new Ambient()).unlock();
    prefs.set({ ambient: id });
  };

  const step = (d: -1 | 1) => {
    if (!timings) return;
    const n = Math.min(verses.length, Math.max(1, (activeRef.current || (d > 0 ? 0 : 1)) + d));
    playFrom(n);
  };

  const status =
    recitation === undefined ? "Memuat murotal…" : recitation === null ? "Murotal gagal dimuat" : active ? `Ayat ${active} dari ${verses.length}` : `${verses.length} ayat`;

  return (
    <div className="qrn qrn-reader" style={textVars(text)}>
      <header className="cal-head">
        <BackLink href="/alquran" label="Kembali ke daftar surah" />
        <div>
          <h1>
            <button type="button" className="qrn-title-btn" onClick={() => setPicking("surah")} aria-haspopup="dialog" aria-label={`${surah.id}. ${surah.name}, pilih surah lain`}>
              {surah.id}. {surah.name}
              <Icon size={18}>
                <path d="m6 9 6 6 6-6" />
              </Icon>
            </button>
          </h1>
          <p>
            <span>
              {surah.meaning} · {surah.verses} ayat · {placeLabel(surah.place)}
            </span>
          </p>
        </div>
        <span className="qrn-head-ar" lang="ar" dir="rtl">
          {surah.arabic}
        </span>
      </header>

      <ListenGoalCard compact />

      <div className="qrn-tools">
        <div className="qrn-qari">
          <button type="button" className="qrn-qari-btn" onClick={() => setPicking("qari")} aria-haspopup="dialog">
            <small>Qari</small>
            <strong>{qariName}</strong>
            <Icon size={16}>
              <path d="m6 9 6 6 6-6" />
            </Icon>
          </button>
          <button type="button" className="qrn-listen-btn" onClick={() => setListening(true)}>
            <Icon size={18}>
              <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
              <rect x="3" y="14" width="5" height="7" rx="2" />
              <rect x="16" y="14" width="5" height="7" rx="2" />
            </Icon>
            Mode dengar
          </button>
        </div>
        <div className="doa-cats" role="group" aria-label="Tampilan bacaan">
          <button type="button" aria-pressed={text.showArti} onClick={() => text.set({ showArti: !text.showArti })}>
            Arti
          </button>
          <button type="button" aria-pressed={text.showLatin} onClick={() => text.set({ showLatin: !text.showLatin })}>
            Latin
          </button>
          <button type="button" aria-pressed={prefs.follow} onClick={() => prefs.set({ follow: !prefs.follow })}>
            Ikuti bacaan
          </button>
        </div>
      </div>

      {surah.bismillah && (
        <p className="arabic qrn-basmalah" dir="rtl" lang="ar">
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>
      )}

      <div className="qrn-verses">
        {verses.map((v) => (
          <VerseRow key={v.n} v={v} on={prefs.follow && active === v.n} showLatin={text.showLatin} showArti={text.showArti} canPlay={!!timings} onPlay={playFrom} />
        ))}
      </div>

      <nav className="qrn-pager" aria-label="Surah lain">
        {prev ? (
          <Link href={`/alquran/${prev.id}`}>
            <small>Sebelumnya</small>
            {prev.name}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/alquran/${next.id}`} className="next">
            <small>Berikutnya</small>
            {next.name}
          </Link>
        )}
      </nav>

      <div className="qrn-player" role="region" aria-label="Pemutar murotal">
        <input
          ref={rangeRef}
          type="range"
          min={0}
          max={0}
          step="any"
          defaultValue={0}
          onChange={(e) => {
            paintFill(e.currentTarget);
            seek(Number(e.currentTarget.value), false);
          }}
          {...drag}
          aria-label="Posisi murotal"
        />
        <div className="qrn-player-row">
          <span className="qrn-time">
            <span ref={nowRef}>0:00</span> / <span ref={lastRef}>0:00</span>
          </span>
          <div className="qrn-btns">
            <button type="button" onClick={() => step(-1)} disabled={!timings} aria-label="Ayat sebelumnya">
              <Icon>
                <path d="M6 5v14M18 6l-9 6 9 6z" />
              </Icon>
            </button>
            <button type="button" className="qrn-play" onClick={toggle} disabled={!recitation} aria-label={playing ? "Jeda" : "Putar"}>
              <Icon size={24}>{playing ? <path d="M8 5v14M16 5v14" /> : <path d="M8 5v14l11-7z" fill="currentColor" />}</Icon>
            </button>
            <button type="button" onClick={() => step(1)} disabled={!timings} aria-label="Ayat berikutnya">
              <Icon>
                <path d="M18 5v14M6 6l9 6-9 6z" />
              </Icon>
            </button>
          </div>
          <span className="qrn-now">
            <strong>{status}</strong>
            <span>{qariName}</span>
          </span>
        </div>
        <audio
          ref={audioRef}
          src={recitation?.url}
          preload="metadata"
          onLoadedMetadata={onMeta}
          onTimeUpdate={onTime}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            save();
          }}
          onEnded={onEnded}
          onEmptied={() => setPlaying(false)}
        />
      </div>

      {picking && (
        <div className="qrn-sheet-wrap" onClick={() => setPicking(null)}>
          <section className="qrn-sheet" role="dialog" aria-modal="true" aria-label={picking === "surah" ? "Pilih surah" : "Pilih qari"} onClick={(e) => e.stopPropagation()}>
            <div className="qrn-sheet-head">
              <h2>{picking === "surah" ? "Pilih surah" : "Pilih qari"}</h2>
              <button type="button" onClick={() => setPicking(null)} aria-label="Tutup">
                <Icon>
                  <path d="M6 6l12 12M18 6 6 18" />
                </Icon>
              </button>
            </div>
            {picking === "surah" ? (
              <SurahList surahs={surahs} current={surah.id} onPick={(id) => goTo(id, false, playing)} />
            ) : (
              <QariList qaris={qaris} current={qari} onPick={changeQari} />
            )}
          </section>
        </div>
      )}

      {listening && (
        <ListenView
          surah={surah}
          surahs={surahs}
          qaris={qaris}
          qari={qari}
          onQari={changeQari}
          verses={verses}
          qariName={qariName}
          active={active}
          playing={playing}
          audioRef={audioRef}
          status={status}
          canPlay={!!recitation}
          canStep={!!timings}
          show={listenShow}
          backgrounds={backgrounds}
          bg={prefs.bg}
          ambient={ambientId}
          ambientVol={prefs.ambientVol}
          autoNext={prefs.autoNext}
          prevName={prev?.name ?? null}
          nextName={next?.name ?? null}
          sleep={sleep}
          onSurah={(id) => goTo(id, true, true)}
          onPrevSurah={() => prev && goTo(prev.id, true, true)}
          onNextSurah={() => next && goTo(next.id, true, true)}
          onToggle={toggle}
          onStep={step}
          onSeek={(sec) => seek(sec, false)}
          onPlayFrom={playFrom}
          onShow={(s) => prefs.set({ lsnArab: s.arab ?? prefs.lsnArab, lsnLatin: s.latin ?? prefs.lsnLatin, lsnArti: s.arti ?? prefs.lsnArti })}
          onBg={(id) => prefs.set({ bg: id })}
          onAmbient={pickAmbient}
          onAmbientVol={(v) => prefs.set({ ambientVol: v })}
          onAutoNext={(on) => prefs.set({ autoNext: on })}
          onSleep={setSleep}
          onClose={closeListen}
        />
      )}
    </div>
  );
}
