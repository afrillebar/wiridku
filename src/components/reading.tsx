"use client";

import Link from "next/link";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Ambient, isAmbient, type AmbientId } from "@/lib/ambient";
import { paintFill } from "@/lib/audio-clock";
import type { ListenBackground } from "@/lib/content";
import { readReadingPlace, useProgress, useQuranPrefs, useReadingPlace, useTextPrefs, writeReadingPlace } from "@/lib/progress";
import { track } from "@/lib/track";
import type { DoaClip } from "@/lib/doa";
import { DEFAULT_QARI, type Qari, type Recitation, type Verse } from "@/lib/quran-types";
import { MODULES, asSurahs, clipLines, type ReadLine, type Reading } from "@/lib/reading";
import type { ReadingModuleId } from "@/lib/progress";
import { OfflineControl, cachedBlob, freshUrl, keyFor } from "./audio";
import { useClipPlayer } from "./clip-player";
import { ListenView, type Sleep } from "./quran-listen";
import { QariList } from "./qari-list";
import { SurahList, matchSurah } from "./surah-list";
import { TasbihBox } from "./tasbih-box";

// Doa Harian, Tahlil & Yasin, Shalawat and Wirid Salat read like the Al-Qur'an pages: a list to choose from, and a page of numbered lines with a player at the bottom and a listening view.

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

const textVars = (t: { arab: number; latin: number; arti: number }) =>
  ({
    "--ar-size": `${t.arab}px`,
    "--latin-size": `${t.latin}px`,
    "--arti-size": `${t.arti}px`,
  }) as CSSProperties;

// ---------- the list ----------

export function ReadingIndex({
  module,
  readings,
  groups,
  base: baseOf,
  preview = false,
}: {
  module: ReadingModuleId;
  readings: Reading[];
  groups?: { id: string; label: string }[];
  base?: string;
  preview?: boolean;
}) {
  const m = MODULES[module];
  const base = baseOf ?? m.base;
  // Wirid Salat: each card is ticked off when done, and a streak counts the days all of them were; the preview shows the ticks but keeps none
  const wirid = module === "wirid";
  const progress = useProgress(wirid ? readings.map((r) => r.slug) : []);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("semua");
  const place = useReadingPlace(module);
  const last = place.slug && !preview ? readings.find((r) => r.slug === place.slug) : undefined;
  const shown = useMemo(
    () =>
      readings
        .map((r, i) => ({ r, i }))
        .filter(
          ({ r }) =>
            (group === "semua" || r.group === group) &&
            matchSurah(
              {
                id: 0,
                name: r.title,
                meaning: r.sub,
                arabic: "",
                place: "makkah",
                verses: 0,
                bismillah: false,
              },
              query,
            ),
        ),
    [readings, query, group],
  );

  return (
    <div className="qrn">
      <header className="cal-head">
        <BackLink href="/" label="Kembali ke Beranda" />
        <div>
          <h1>{m.heading}</h1>
          <p>
            <span>{wirid ? `${readings.filter((r) => progress.done.has(r.slug)).length} dari ${readings.length} selesai hari ini` : `${readings.length} ${m.part}`}</span>
          </p>
        </div>
        {wirid && (
          <span className="qrn-head-ar streak" aria-label={`Beruntun ${progress.streak} hari`}>
            🔥 {progress.streak}
          </span>
        )}
      </header>

      {last && (
        <Link className="qrn-resume" href={`${base}/${last.slug}`}>
          <span>
            <small>Terakhir didengar</small>
            <strong>{last.title}</strong>
            {last.lines.length > 1 && (
              <span>
                {m.unit === "baris" ? "Baris" : m.unit} {Math.min(place.line + 1, last.lines.length)}
              </span>
            )}
          </span>
          <span className="qrn-resume-go">Lanjutkan</span>
        </Link>
      )}

      <div className="doa-search">
        <Icon size={18}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </Icon>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Cari ${m.part}`} aria-label={`Cari ${m.part}`} autoComplete="off" />
      </div>

      {groups && (
        <div className="doa-cats" role="group" aria-label="Kelompok">
          {[{ id: "semua", label: "Semua" }, ...groups].map((g) => (
            <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
              {g.label}
            </button>
          ))}
        </div>
      )}

      <ol className="qrn-list">
        {shown.map(({ r, i }, k) => (
          <Fragment key={r.slug}>
            {wirid && r.extra && r.extra.phase !== shown[k - 1]?.r.extra?.phase && (
              <li className="qrn-phase">
                <h2>{r.extra.phase}</h2>
              </li>
            )}
            <li className={wirid ? "qrn-item" : undefined}>
              <Link href={`${base}/${r.slug}`} className="qrn-row">
                <span className="qrn-num">{r.extra?.number ?? i + 1}</span>
                <span className="qrn-name">
                  <strong>{r.title}</strong>
                  <span>{r.sub}</span>
                </span>
                {r.arabic && (
                  <span className="qrn-ar" lang="ar" dir="rtl">
                    {r.arabic}
                  </span>
                )}
              </Link>
              {wirid && (
                <button
                  type="button"
                  className={`check-btn${progress.done.has(r.slug) ? " on" : ""}`}
                  aria-pressed={progress.done.has(r.slug)}
                  aria-label={`Tandai selesai: ${r.title}`}
                  data-tip={progress.done.has(r.slug) ? "Batalkan tanda selesai" : "Tandai selesai"}
                  data-tip-align="end"
                  onClick={() => !preview && progress.toggle(r.slug)}
                >
                  ✓
                </button>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
      {!shown.length && (
        <p className="doa-empty" role="status">
          Tidak ditemukan. Coba kata lain.
        </p>
      )}
    </div>
  );
}

// ---------- one reading ----------

type RowProps = {
  line: ReadLine;
  id: number;
  on: boolean;
  showLatin: boolean;
  showArti: boolean;
  canPlay: boolean;
  onPlay: (id: number) => void;
};

// memo: the player re-renders several times a second, the rows only when the highlighted line changes
const Row = memo(function Row({ line, id, on, showLatin, showArti, canPlay, onPlay }: RowProps) {
  return (
    <article id={`ayat-${id}`} className={`qrn-ayah${on ? " on" : ""}`} aria-current={on ? "true" : undefined}>
      <div className="qrn-ayah-head">
        <span className="qrn-num">{line.n}</span>
        <button type="button" className="qrn-ayah-play" onClick={() => onPlay(id)} disabled={!canPlay} aria-label={`Putar dari baris ${line.n}`} data-tip="Putar dari sini" data-tip-align="end">
          <Icon size={16}>
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </Icon>
        </button>
      </div>
      {line.name && <p className="reading-name">{line.name}</p>}
      <p className="arabic" dir="rtl" lang="ar">
        {line.ar}
      </p>
      {showLatin && line.la && <p className="latin">{line.la}</p>}
      {showArti && line.ti && <p className="arti">{line.ti}</p>}
    </article>
  );
});

const seconds = (ms: number) => Math.round(ms / 10) / 100;
const Chevron = () => (
  <Icon size={16}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export function ReadingReader({
  module,
  readings,
  slug,
  backgrounds,
  qaris,
  base: baseOf,
  preview = false,
}: {
  module: ReadingModuleId;
  readings: Reading[];
  slug: string;
  backgrounds: ListenBackground[];
  qaris?: Qari[];
  base?: string;
  preview?: boolean;
}) {
  const m = MODULES[module];
  const base = baseOf ?? m.base;
  const wirid = module === "wirid";
  const progress = useProgress(wirid ? readings.map((r) => r.slug) : []);
  const text = useTextPrefs();
  // the look of the listening view, the background sound and "follow" are shared with the Al-Qur'an pages
  const prefs = useQuranPrefs(DEFAULT_QARI);
  const [now, setNow] = useState(slug);
  const idx = Math.max(
    0,
    readings.findIndex((r) => r.slug === now),
  );
  const reading = readings[idx];
  const extra = reading.extra;
  const prev = readings[idx - 1] ?? null;
  const next = readings[idx + 1] ?? null;
  const [listening, setListening] = useState(false);
  const [picking, setPicking] = useState<null | "reading" | "qari">(null);
  const [sleep, setSleep] = useState<Sleep>(null);
  const ambient = useRef<Ambient | null>(null);
  const ambientId: AmbientId | null = isAmbient(prefs.ambient) ? prefs.ambient : null;
  const lastSave = useRef(0);
  const listenShow = useMemo(() => ({ arab: prefs.lsnArab, latin: prefs.lsnLatin, arti: prefs.lsnArti }), [prefs.lsnArab, prefs.lsnLatin, prefs.lsnArti]);
  // the reciter: the readings made of Qur'an verses can be heard by any reciter of Quran.com (as in the Al-Qur'an pages), the rest have one voice
  const fallbackQari = qaris?.some((q) => q.id === DEFAULT_QARI) ? DEFAULT_QARI : (qaris?.[0]?.id ?? DEFAULT_QARI);
  const qari = qaris?.some((q) => q.id === prefs.qari) ? prefs.qari : fallbackQari;
  const switchable = !!qaris?.length && !!reading.quran;
  const own = !!reading.quran && !!qaris?.length && qari !== DEFAULT_QARI;
  // the clips of another reciter, fetched when asked for: "reciter:reading" -> clips, an empty list when they could not be had
  const [heard, setHeard] = useState<Record<string, DoaClip[]>>({});
  const key = `${qari}:${now}`;
  const ready = !own || !!heard[key]?.length;
  // Wirid Salat recordings are signed links that can be missing or out of date, and may be saved on the device: the link or copy to use in place of the one in the page
  const [fresh, setFresh] = useState<Record<string, string>>({});
  const refresh = useCallback(async (s: string) => {
    const url = await freshUrl(s);
    if (url) setFresh((f) => ({ ...f, [s]: url }));
    return url;
  }, []);
  const clips = useMemo(
    () =>
      Object.fromEntries(
        readings.map((r) => {
          const list = r.quran && qaris?.length && qari !== DEFAULT_QARI ? (heard[`${qari}:${r.slug}`] ?? []) : r.clips;
          return [r.slug, fresh[r.slug] ? list.map((c) => ({ ...c, url: fresh[r.slug] })) : list];
        }),
      ),
    [readings, qaris, qari, heard, fresh],
  );
  // what to do once the clips of a reading have arrived: from which line, and whether to play
  const pending = useRef<{ line: number; go: boolean } | null>(null);
  const titleOf = useCallback((s: string) => readings.find((r) => r.slug === s)?.title ?? m.heading, [readings, m.heading]);

  // the sound follows the line only when the clips add up to the lines of the text
  const tracked = clipLines(clips[now] ?? []) === reading.lines.length;

  const save = () => {
    const s = snapshot();
    if (s && !preview)
      writeReadingPlace(module, {
        slug: s.slug,
        part: s.part,
        t: Math.floor(s.t),
        line: s.line,
      });
  };

  // a reading that ran out sends "Lanjutkan" to the start of the next one
  const onEnded = (done: string) => {
    const i = readings.findIndex((r) => r.slug === done);
    const after = readings[i + 1];
    if (!preview)
      writeReadingPlace(module, {
        slug: (after ?? readings[i]).slug,
        part: 0,
        t: 0,
        line: 0,
      });
    if (wirid && !preview) track("complete", done);
    if (sleep === "end") {
      setSleep(null);
      return;
    }
    if (after && prefs.autoNext) open(after.slug, true);
  };

  const {
    cur,
    line,
    playing,
    failed,
    play,
    load,
    loadLine,
    toggle: toggleSound,
    step,
    snapshot,
    audioRef,
    clipRef,
    rangeRef,
    nowRef,
    lastRef,
    drag,
    audioProps,
  } = useClipPlayer({
    clips,
    titleOf,
    artist: m.heading,
    onEnded,
    refresh,
    onPlay: (s) => wirid && !preview && track("play", s),
  });

  // another reading of the same list: the page stays, so the sound and the listening view carry on
  const open = (to: string, go: boolean) => {
    if (to === now && !go) return;
    setPicking(null);
    setNow(to);
    window.history.replaceState(null, "", `${base}/${to}`);
    if (qari !== DEFAULT_QARI && readings.find((r) => r.slug === to)?.quran && !heard[`${qari}:${to}`]?.length) pending.current = { line: 0, go };
    else if (go) play(to, 0);
    else load(to);
    if (!listening) window.scrollTo({ top: 0 });
  };

  // arriving: the place last heard here, or the start of this reading
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = preview ? { slug: null, part: 0, t: 0, line: 0 } : readReadingPlace(module);
      if (own)
        pending.current = {
          line: saved.slug === slug ? saved.line : 0,
          go: false,
        };
      else if (saved.slug === slug) load(slug, saved.part, saved.t);
      else load(slug);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a recording saved on the device is used instead of the link, so it plays offline
  useEffect(() => {
    const o = extra?.offline;
    if (!o) return;
    let alive = true;
    cachedBlob(keyFor({ path: o.path, version: o.version, synthetic: o.synthetic }))
      .then((b) => alive && b && setFresh((f) => ({ ...f, [now]: URL.createObjectURL(b) })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [now, extra]);

  // a card without a link in the page asks for one
  useEffect(() => {
    if (!reading.clips.length || reading.clips[0].url || fresh[now]) return;
    const t = setTimeout(() => void refresh(now), 0);
    return () => clearTimeout(t);
  }, [now, reading, fresh, refresh]);

  useEffect(() => {
    if (!own || heard[key]) return;
    const refs = reading.quran ?? [];
    const ctrl = new AbortController();
    Promise.all(
      refs.map((r) =>
        fetch(`/api/quran/audio?qari=${qari}&surah=${r.surah}`, {
          signal: ctrl.signal,
        }).then((x) => (x.ok ? (x.json() as Promise<Recitation>) : Promise.reject(new Error(String(x.status))))),
      ),
    )
      .then((recs) =>
        recs.map((rec, i): DoaClip => {
          const r = refs[i];
          // without one timing per verse the stretch cannot be cut out
          if (rec.timings.length !== r.verses) throw new Error("timings");
          return {
            url: rec.url,
            from: seconds(rec.timings[r.from - 1][0]),
            to: seconds(rec.timings[r.to - 1][1]),
            marks: rec.timings.slice(r.from - 1, r.to).map((t) => seconds(t[0])),
          };
        }),
      )
      .then((list) => setHeard((h) => ({ ...h, [key]: list })))
      .catch(() => {
        if (!ctrl.signal.aborted) setHeard((h) => ({ ...h, [key]: [] }));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own, key]);

  useEffect(() => {
    if (!ready || !pending.current) return;
    const p = pending.current;
    pending.current = null;
    const t = setTimeout(() => (p.go ? play(now, p.line) : loadLine(now, p.line)), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  // the background sound keeps the reading company: it plays only while the sound plays
  useEffect(() => {
    if (!ambientId || !playing) {
      ambient.current?.stop();
      return;
    }
    ambient.current ??= new Ambient();
    ambient.current.play(ambientId, prefs.ambientVol);
  }, [ambientId, playing, prefs.ambientVol]);

  useEffect(() => () => ambient.current?.close(), []);

  useEffect(() => {
    if (typeof sleep !== "object" || sleep === null) return;
    const id = setTimeout(
      () => {
        audioRef.current?.pause();
        setSleep(null);
      },
      Math.max(0, sleep.at - Date.now()),
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleep]);

  // closing the tab or switching apps mid-reading still keeps the place
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") saveRef.current();
    };
    const gone = () => saveRef.current();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", gone);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", gone);
    };
  }, []);

  // the line being read, counted from 1 like the verses of a surah; 0 before any
  const active = tracked && cur?.slug === now ? line + 1 : 0;

  // from the second line on the page follows the sound; the first is already in view. Not while the listening view covers the page.
  useEffect(() => {
    if (!prefs.follow || active < 2 || listening) return;
    const el = document.getElementById(`ayat-${active}`);
    if (!el) return;
    // a long jump lands at once; only a step to a nearby line glides
    const far = Math.abs(el.getBoundingClientRect().top + el.offsetHeight / 2 - innerHeight / 2) > innerHeight * 1.5;
    const smooth = !far && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      block: "center",
      behavior: smooth ? "smooth" : "auto",
    });
  }, [active, prefs.follow, listening]);

  const playLine = useCallback(
    (n: number) => {
      if (ambientId) (ambient.current ??= new Ambient()).unlock();
      play(now, n - 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, ambientId],
  );

  const toggle = () => {
    // iOS only lets Web Audio make sound when it is started from a tap
    if (ambientId) (ambient.current ??= new Ambient()).unlock();
    if (cur?.slug !== now) play(now, 0);
    else toggleSound();
  };

  const seek = (v: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = (clipRef.current?.from ?? 0) + v;
  };

  // another reciter: the same line carries on in the new voice
  const changeQari = (id: number) => {
    setPicking(null);
    if (id === qari) return;
    const a = audioRef.current;
    pending.current = reading.quran ? { line: Math.max(0, line), go: !!a && !a.paused } : null;
    a?.pause();
    prefs.set({ qari: id });
  };

  const pickAmbient = (id: AmbientId | null) => {
    if (id) (ambient.current ??= new Ambient()).unlock();
    prefs.set({ ambient: id });
  };

  const verses: Verse[] = useMemo(
    () =>
      reading.lines.map((l, i) => ({
        n: i + 1,
        arabic: l.ar,
        latin: l.la ?? "",
        arti: l.ti ?? "",
        key: l.key ?? l.n,
      })),
    [reading],
  );
  const surahs = useMemo(() => asSurahs(readings), [readings]);
  const waiting = own && !heard[key];
  const missing = own && !!heard[key] && !heard[key].length;
  const status = missing
    ? "Murotal gagal dimuat"
    : waiting
      ? "Memuat murotal…"
      : tracked && active
        ? `${m.unit === "baris" ? "Baris" : m.unit} ${active} dari ${reading.lines.length}`
        : `${reading.lines.length} ${m.unit}`;
  const hasAudio = reading.clips.length > 0;
  const canPlay = ready && (clips[now] ?? []).length > 0 && (clips[now] ?? []).every((c) => c.url);
  const qariName = switchable ? (qaris?.find((q) => q.id === qari)?.name ?? reading.voice) : reading.voice;
  const canStep = canPlay && tracked && reading.lines.length > 1;

  return (
    <div className="qrn qrn-reader" style={textVars(text)}>
      <header className="cal-head">
        <BackLink href={base} label={`Kembali ke daftar ${m.part}`} />
        <div>
          <h1>
            <button type="button" className="qrn-title-btn" onClick={() => setPicking("reading")} aria-haspopup="dialog" aria-label={`${idx + 1}. ${reading.title}, pilih ${m.part} lain`}>
              {idx + 1}. {reading.title}
              <Icon size={18}>
                <path d="m6 9 6 6 6-6" />
              </Icon>
            </button>
          </h1>
          <p>
            <span>{reading.sub}</span>
          </p>
        </div>
        {reading.arabic && (
          <span className="qrn-head-ar" lang="ar" dir="rtl">
            {reading.arabic}
          </span>
        )}
      </header>

      <div className="qrn-tools">
        <div className="qrn-qari">
          {switchable ? (
            <button type="button" className="qrn-qari-btn" onClick={() => setPicking("qari")} aria-haspopup="dialog">
              <small>Qari</small>
              <strong>{qariName}</strong>
              <Chevron />
            </button>
          ) : (
            <div className="qrn-qari-btn static">
              <small>Qari</small>
              <strong>{qariName}</strong>
            </div>
          )}
          {hasAudio && (
            <button type="button" className="qrn-listen-btn" onClick={() => setListening(true)}>
              <Icon size={18}>
                <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
                <rect x="3" y="14" width="5" height="7" rx="2" />
                <rect x="16" y="14" width="5" height="7" rx="2" />
              </Icon>
              Mode dengar
            </button>
          )}
        </div>
        <div className="doa-cats" role="group" aria-label="Tampilan bacaan">
          <button type="button" aria-pressed={text.showArti} onClick={() => text.set({ showArti: !text.showArti })}>
            Arti
          </button>
          <button type="button" aria-pressed={text.showLatin} onClick={() => text.set({ showLatin: !text.showLatin })}>
            Latin
          </button>
          {hasAudio && (
            <button type="button" aria-pressed={prefs.follow} onClick={() => prefs.set({ follow: !prefs.follow })}>
              Ikuti bacaan
            </button>
          )}
          {wirid && (
            <button type="button" aria-pressed={progress.done.has(reading.slug)} onClick={() => !preview && progress.toggle(reading.slug)}>
              ✓ Selesai
            </button>
          )}
        </div>
      </div>

      {extra?.tasbih && (
        <>
          <TasbihBox steps={extra.tasbih} />
          <p className="arti-label closing-label">Bacaan penyempurna (1×)</p>
        </>
      )}
      <div className="qrn-verses">
        {reading.lines.map((l, i) => (
          <Row key={`${now}-${i}`} line={l} id={i + 1} on={prefs.follow && active === i + 1} showLatin={text.showLatin} showArti={text.showArti} canPlay={canPlay && tracked} onPlay={playLine} />
        ))}
      </div>
      {reading.ref && <p className="reading-ref">Sumber: {reading.ref}</p>}
      {extra?.offline && reading.clips[0] && (
        <OfflineControl
          track={{
            slug: reading.slug,
            title: reading.title,
            audio: {
              path: extra.offline.path,
              url: reading.clips[0].url || null,
              version: extra.offline.version,
              duration: null,
              offline: true,
              reciter: null,
              synthetic: extra.offline.synthetic,
            },
          }}
        />
      )}

      <nav className="qrn-pager" aria-label={`${m.part} lain`}>
        {prev ? (
          <a
            href={`${base}/${prev.slug}`}
            onClick={(e) => {
              e.preventDefault();
              open(prev.slug, playing);
            }}
          >
            <small>Sebelumnya</small>
            {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a
            href={`${base}/${next.slug}`}
            className="next"
            onClick={(e) => {
              e.preventDefault();
              open(next.slug, playing);
            }}
          >
            <small>Berikutnya</small>
            {next.title}
          </a>
        )}
      </nav>

      {hasAudio && (
        <div className="qrn-player" role="region" aria-label={`Pemutar ${m.part}`}>
          <input
            ref={rangeRef}
            type="range"
            min={0}
            max={0}
            step="any"
            defaultValue={0}
            onChange={(e) => {
              paintFill(e.currentTarget);
              seek(Number(e.currentTarget.value));
            }}
            {...drag}
            aria-label="Posisi audio"
          />
          <div className="qrn-player-row">
            <span className="qrn-time">
              <span ref={nowRef}>0:00</span> / <span ref={lastRef}>0:00</span>
            </span>
            <div className="qrn-btns">
              <button type="button" onClick={() => step(-1)} disabled={!canStep} aria-label="Baris sebelumnya">
                <Icon>
                  <path d="M6 5v14M18 6l-9 6 9 6z" />
                </Icon>
              </button>
              <button type="button" className="qrn-play" onClick={toggle} disabled={!canPlay} aria-label={playing ? "Jeda" : "Putar"}>
                <Icon size={24}>{playing ? <path d="M8 5v14M16 5v14" /> : <path d="M8 5v14l11-7z" fill="currentColor" />}</Icon>
              </button>
              <button type="button" onClick={() => step(1)} disabled={!canStep} aria-label="Baris berikutnya">
                <Icon>
                  <path d="M18 5v14M6 6l9 6-9 6z" />
                </Icon>
              </button>
            </div>
            <span className="qrn-now">
              <strong>{failed ? "Audio gagal dimuat" : status}</strong>
              <span>{qariName}</span>
            </span>
          </div>
        </div>
      )}
      <audio
        ref={audioRef}
        {...audioProps}
        onTimeUpdate={() => {
          audioProps.onTimeUpdate();
          if (audioRef.current && !audioRef.current.paused && Date.now() - lastSave.current > 5000) {
            lastSave.current = Date.now();
            save();
          }
        }}
        onPause={() => {
          audioProps.onPause();
          save();
        }}
      />

      {picking && (
        <div className="qrn-sheet-wrap" onClick={() => setPicking(null)}>
          <section className="qrn-sheet" role="dialog" aria-modal="true" aria-label={picking === "reading" ? `Pilih ${m.part}` : "Pilih qari"} onClick={(e) => e.stopPropagation()}>
            <div className="qrn-sheet-head">
              <h2>{picking === "reading" ? `Pilih ${m.part}` : "Pilih qari"}</h2>
              <button type="button" onClick={() => setPicking(null)} aria-label="Tutup">
                <Icon>
                  <path d="M6 6l12 12M18 6 6 18" />
                </Icon>
              </button>
            </div>
            {picking === "reading" ? (
              <SurahList surahs={surahs} current={idx + 1} onPick={(id) => open(readings[id - 1].slug, playing)} unit={m.unit} noun={m.part} />
            ) : (
              <QariList qaris={qaris ?? []} current={qari} onPick={changeQari} />
            )}
          </section>
        </div>
      )}

      {listening && (
        <ListenView
          labels={{ part: m.part, unit: m.unit, audio: "audio" }}
          qariPick={switchable}
          surah={surahs[idx]}
          surahs={surahs}
          qaris={qaris ?? []}
          qari={qari}
          onQari={changeQari}
          verses={verses}
          qariName={qariName}
          active={active}
          playing={playing}
          audioRef={audioRef}
          clipRef={clipRef}
          status={failed ? "Audio gagal dimuat" : status}
          canPlay={canPlay}
          canStep={canStep}
          show={listenShow}
          backgrounds={backgrounds}
          bg={prefs.bg}
          ambient={ambientId}
          ambientVol={prefs.ambientVol}
          autoNext={prefs.autoNext}
          prevName={prev?.title ?? null}
          nextName={next?.title ?? null}
          sleep={sleep}
          onSurah={(id) => open(readings[id - 1].slug, true)}
          onPrevSurah={() => prev && open(prev.slug, true)}
          onNextSurah={() => next && open(next.slug, true)}
          onToggle={toggle}
          onStep={step}
          onSeek={seek}
          onPlayFrom={playLine}
          onShow={(s) =>
            prefs.set({
              lsnArab: s.arab ?? prefs.lsnArab,
              lsnLatin: s.latin ?? prefs.lsnLatin,
              lsnArti: s.arti ?? prefs.lsnArti,
            })
          }
          onBg={(id) => prefs.set({ bg: id })}
          onAmbient={pickAmbient}
          onAmbientVol={(v) => prefs.set({ ambientVol: v })}
          onAutoNext={(on) => prefs.set({ autoNext: on })}
          onSleep={setSleep}
          onClose={() => setListening(false)}
        />
      )}
    </div>
  );
}
