"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { paintFill, useAudioClock, type Clip } from "@/lib/audio-clock";
import { PRAYER_CATEGORIES, categoryLabel, type DoaAudio, type Prayer } from "@/lib/doa";
import { useDoaState, useTextPrefs } from "@/lib/progress";

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const lines = (s: string | null) => (s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

// Arabic, latin and meaning are written line for line; when they line up they are shown as one block per line
function blocks(p: Prayer) {
  const ar = lines(p.arabic_text);
  const la = lines(p.transliteration);
  const ti = lines(p.translation);
  const same = (n: number) => n === 0 || n === ar.length;
  if (same(la.length) && same(ti.length)) return ar.map((a, i) => ({ ar: a, la: la[i] ?? null, ti: ti[i] ?? null }));
  return [{ ar: ar.join("\n"), la: la.join("\n") || null, ti: ti.join("\n") || null }];
}

const plain = (s: string) => s.toLowerCase().replace(/['’`-]/g, "");

function copyText(p: Prayer) {
  return [p.title, "", p.arabic_text, "", p.transliteration, "", p.translation, "", p.reference_text ? `(${p.reference_text})` : ""].filter((x) => x !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

type CardProps = { p: Prayer; open: boolean; onToggle: () => void; showLatin: boolean; showArti: boolean; canPlay: boolean; current: boolean; playing: boolean; onPlay: () => void };

function DoaCard({ p, open, onToggle, showLatin, showArti, canPlay, current, playing, onPlay }: CardProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText(p));
    } catch {
      // ponytail: older browsers and plain http have no clipboard API; a hidden textarea still copies on a tap
      const t = document.createElement("textarea");
      t.value = copyText(p);
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <article id={p.slug} className={`doa-card${open ? " open" : ""}${current ? " now" : ""}`}>
      <div className="doa-top">
        <button type="button" className="doa-head" aria-expanded={open} aria-controls={`${p.slug}-body`} onClick={onToggle}>
          <span>
            <strong>{p.title}</strong>
            {p.repeat_label && <em>{p.repeat_label}</em>}
          </span>
          <Icon size={18}>
            <path d="m6 9 6 6 6-6" />
          </Icon>
        </button>
        {canPlay && (
          <button type="button" className="doa-play" onClick={onPlay} aria-label={`${current && playing ? "Jeda" : "Putar"} ${p.title}`} data-tip={current && playing ? "Jeda" : "Putar audio"} data-tip-align="end">
            <Icon size={18}>{current && playing ? <path d="M8 5v14M16 5v14" /> : <path d="M8 5v14l11-7z" fill="currentColor" />}</Icon>
          </button>
        )}
      </div>
      {open && (
        <div className="doa-body" id={`${p.slug}-body`}>
          {p.note && <p className="doa-note">{p.note}</p>}
          {blocks(p).map((b, i) => (
            <section key={i} className="doa-line">
              <p className="arabic" dir="rtl" lang="ar">
                {b.ar}
              </p>
              {showLatin && b.la && <p className="latin">{b.la}</p>}
              {showArti && b.ti && (
                <>
                  <p className="arti-label">Arti</p>
                  <p className="arti">{b.ti}</p>
                </>
              )}
            </section>
          ))}
          <div className="doa-foot">
            {p.reference_text && <p className="source">Sumber: {p.reference_text}</p>}
            <button type="button" className="doa-copy" onClick={copy}>
              <Icon size={16}>
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V6a2 2 0 0 1 2-2h9" />
              </Icon>
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function DoaHarian({ prayers, audio }: { prayers: Prayer[]; audio: DoaAudio }) {
  const prefs = useTextPrefs();
  const doa = useDoaState();
  const setDoa = doa.set;
  const audioRef = useRef<HTMLAudioElement>(null);
  const clipRef = useRef<Clip | null>(null);
  const [cur, setCur] = useState<{ slug: string; part: number } | null>(null);
  const curRef = useRef(cur);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  // armed: the playhead has reached the clip; done: the last clip ran out, so Putar starts the doa again
  const armed = useRef(false);
  const done = useRef(false);
  const { rangeRef, nowRef, lastRef, drag } = useAudioClock(audioRef, playing, "total", clipRef);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("semua");
  const [open, setOpen] = useState<Set<string>>(new Set());

  // a link such as /doa-harian#masuk-masjid opens that card
  useEffect(() => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (!slug || !prayers.some((p) => p.slug === slug)) return;
    const t = setTimeout(() => {
      setOpen((o) => new Set(o).add(slug));
      requestAnimationFrame(() => document.getElementById(slug)?.scrollIntoView({ block: "start" }));
    }, 0);
    return () => clearTimeout(t);
  }, [prayers]);

  const present = useMemo(() => PRAYER_CATEGORIES.filter((c) => prayers.some((p) => p.category === c.id)), [prayers]);
  const shown = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    return prayers.filter((p) => {
      if (cat !== "semua" && p.category !== cat) return false;
      if (!words.length) return true;
      const hay = plain([p.title, p.transliteration, p.translation, p.note, categoryLabel(p.category)].filter(Boolean).join(" "));
      return words.every((w) => hay.includes(w));
    });
  }, [prayers, query, cat]);

  const groups = PRAYER_CATEGORIES.map((c) => ({ ...c, items: shown.filter((p) => p.category === c.id) })).filter((g) => g.items.length);
  const toggle = (slug: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (!n.delete(slug)) n.add(slug);
      return n;
    });

  // ---------- audio: streamed from the source (Hisnul Muslim, Quran.com), nothing is downloaded or stored ----------
  const queue = groups.flatMap((g) => g.items).filter((p) => audio[p.slug]);
  const withAudio = prayers.filter((p) => audio[p.slug]).length;
  const live = useRef({ queue, autoNext: doa.autoNext });
  const finishRef = useRef<() => void>(() => {});
  const stepRef = useRef<(d: -1 | 1) => void>(() => {});

  const play = (slug: string, part = 0) => {
    const a = audioRef.current;
    const clip = audio[slug]?.[part];
    if (!a || !clip) return;
    const from = clip.from ?? 0;
    clipRef.current = { from, to: clip.to ?? null };
    curRef.current = { slug, part };
    armed.current = false;
    done.current = false;
    setCur({ slug, part });
    setFailed(false);
    if (part === 0) setDoa({ slug });
    // ponytail: a clip deep inside a surah file would first sound from second 0; mute until the playhead is at the clip
    if (a.src !== clip.url) {
      a.muted = from > 0;
      a.src = clip.url;
    } else a.muted = false;
    try {
      a.currentTime = from;
    } catch {}
    a.play().catch(() => {});
    setOpen((o) => (o.has(slug) ? o : new Set(o).add(slug)));
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => document.getElementById(slug)?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" }), 60);
  };

  const finish = () => {
    const a = audioRef.current;
    const c = curRef.current;
    if (!a || !c || !armed.current) return;
    armed.current = false;
    if (c.part + 1 < audio[c.slug].length) return play(c.slug, c.part + 1);
    a.pause();
    done.current = true;
    const { queue: q, autoNext } = live.current;
    const i = q.findIndex((x) => x.slug === c.slug);
    const next = autoNext && i >= 0 ? q[i + 1] : undefined;
    if (next) play(next.slug);
  };

  const step = (d: -1 | 1) => {
    const i = queue.findIndex((x) => x.slug === curRef.current?.slug);
    const target = i >= 0 ? queue[i + d] : undefined;
    if (target) play(target.slug);
  };

  const toggleAudio = (slug: string) => {
    const a = audioRef.current;
    if (curRef.current?.slug !== slug || !a) return play(slug);
    if (!a.paused) a.pause();
    else if (done.current) play(slug);
    else a.play().catch(() => {});
  };

  // the end of a clip, and the unmuting once the playhead has arrived, are watched every frame and on every timeupdate
  const watch = () => {
    const a = audioRef.current;
    const c = clipRef.current;
    if (!a || !c) return;
    const t = a.currentTime;
    if (!armed.current) {
      if (t < c.from - 0.05 || (c.to !== null && t >= c.to)) return;
      armed.current = true;
      a.muted = false;
      return;
    }
    if (c.to !== null && t >= c.to) finishRef.current();
  };

  useEffect(() => {
    live.current = { queue, autoNext: doa.autoNext };
    finishRef.current = finish;
    stepRef.current = step;
  });

  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      watch();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  // ponytail: Next keeps this page mounted but hidden after navigating away; the sound must not carry on with no way to stop it
  useLayoutEffect(() => {
    const a = audioRef.current;
    return () => a?.pause();
  }, []);

  const curSlug = cur?.slug;
  useEffect(() => {
    if (!curSlug || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title: prayers.find((p) => p.slug === curSlug)?.title ?? "Doa", artist: "Doa Harian", album: "Wiridku", artwork: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }] });
    ms.setActionHandler("play", () => void audioRef.current?.play().catch(() => {}));
    ms.setActionHandler("pause", () => audioRef.current?.pause());
    ms.setActionHandler("previoustrack", () => stepRef.current(-1));
    ms.setActionHandler("nexttrack", () => stepRef.current(1));
  }, [curSlug, prayers]);

  const curIndex = queue.findIndex((x) => x.slug === curSlug);
  const curTitle = prayers.find((p) => p.slug === curSlug)?.title ?? "";
  const last = !cur && doa.slug && audio[doa.slug] ? prayers.find((p) => p.slug === doa.slug) : undefined;

  return (
    <div className={`doa${cur ? " has-player" : ""}`} style={{ "--ar-size": `${prefs.arab}px`, "--latin-size": `${prefs.latin}px`, "--arti-size": `${prefs.arti}px` } as CSSProperties}>
      <header className="cal-head">
        <Link href="/" className="cal-back" aria-label="Kembali ke Beranda" data-tip="Kembali ke Beranda" data-tip-align="start">
          <Icon>
            <path d="M15 5l-7 7 7 7" />
          </Icon>
        </Link>
        <div>
          <h1>Doa Harian</h1>
          <p>
            <span>
              {prayers.length} doa dari Al-Qur&apos;an dan hadis{withAudio ? ` · ${withAudio} dengan audio` : ""}
            </span>
          </p>
        </div>
      </header>

      {last && (
        <button type="button" className="qrn-resume doa-resume" onClick={() => play(last.slug)}>
          <span>
            <small>Terakhir didengar</small>
            <strong>{last.title}</strong>
          </span>
          <span className="qrn-resume-go">Putar</span>
        </button>
      )}

      <div className="doa-search">
        <Icon size={18}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </Icon>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari doa, mis. makan, hujan, safar" aria-label="Cari doa" autoComplete="off" />
      </div>

      <div className="doa-cats" role="group" aria-label="Kelompok doa">
        {[{ id: "semua", label: "Semua" }, ...present].map((c) => (
          <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <section key={g.id} className="doa-group" aria-label={g.label}>
          <h2>
            {g.label} <span>{g.items.length}</span>
          </h2>
          {g.items.map((p) => (
            <DoaCard
              key={p.slug}
              p={p}
              open={open.has(p.slug)}
              onToggle={() => toggle(p.slug)}
              showLatin={prefs.showLatin}
              showArti={prefs.showArti}
              canPlay={!!audio[p.slug]}
              current={curSlug === p.slug}
              playing={playing}
              onPlay={() => toggleAudio(p.slug)}
            />
          ))}
        </section>
      ))}
      {!groups.length && (
        <p className="doa-empty" role="status">
          {prayers.length ? "Tidak ada doa yang cocok. Coba kata lain, atau pilih kelompok Semua." : "Belum ada doa yang diterbitkan."}
        </p>
      )}

      <p className="doa-note-foot">
        Ukuran huruf, latin, dan terjemahan bisa diatur di <Link href="/pengaturan/bacaan">Pengaturan, Tampilan Bacaan</Link>. Teks Arab dan sumbernya mengikuti Hisnul Muslim dan mushaf Al-Qur&apos;an.
        {withAudio > 0 && " Audio diputar langsung dari Hisnul Muslim (hisnmuslim.com) dan, untuk doa dari Al-Qur'an, dari bacaan Mishary Alafasy di Quran.com; butuh internet."}
        {withAudio > 0 && withAudio < prayers.length && " Doa tanpa tombol putar belum punya rekaman."}
      </p>

      {cur && (
        <div className="qrn-player doa-player" role="region" aria-label="Pemutar doa">
          <input
            ref={rangeRef}
            type="range"
            min={0}
            max={0}
            step="any"
            defaultValue={0}
            onChange={(e) => {
              paintFill(e.currentTarget);
              const a = audioRef.current;
              const c = clipRef.current;
              if (a && c) a.currentTime = c.from + Number(e.currentTarget.value);
            }}
            {...drag}
            aria-label="Posisi audio doa"
          />
          <div className="qrn-player-row">
            <span className="qrn-time">
              <span ref={nowRef}>0:00</span> / <span ref={lastRef}>0:00</span>
            </span>
            <div className="qrn-btns">
              <button type="button" onClick={() => step(-1)} disabled={curIndex <= 0} aria-label="Doa sebelumnya">
                <Icon>
                  <path d="M6 5v14M18 6l-9 6 9 6z" />
                </Icon>
              </button>
              <button type="button" className="qrn-play" onClick={() => toggleAudio(cur.slug)} aria-label={playing ? "Jeda" : "Putar"}>
                <Icon size={24}>{playing ? <path d="M8 5v14M16 5v14" /> : <path d="M8 5v14l11-7z" fill="currentColor" />}</Icon>
              </button>
              <button type="button" onClick={() => step(1)} disabled={curIndex < 0 || curIndex >= queue.length - 1} aria-label="Doa berikutnya">
                <Icon>
                  <path d="M18 5v14M6 6l9 6-9 6z" />
                </Icon>
              </button>
            </div>
            <span className="qrn-now">
              <strong>{curTitle}</strong>
              {failed ? <span role="alert">Audio gagal dimuat</span> : <span>{curIndex >= 0 ? `${curIndex + 1} dari ${queue.length}` : "di luar daftar"}</span>}
              <button type="button" className="doa-auto" aria-pressed={doa.autoNext} onClick={() => setDoa({ autoNext: !doa.autoNext })}>
                Lanjut otomatis
              </button>
            </span>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEmptied={() => setPlaying(false)}
        onEnded={() => {
          armed.current = true;
          finish();
        }}
        onTimeUpdate={watch}
        onSeeked={watch}
        onLoadedMetadata={() => {
          const a = audioRef.current;
          const c = clipRef.current;
          // a clip deep in a file: the start position set before loading is not honoured everywhere
          if (a && c && Math.abs(a.currentTime - c.from) > 0.5) a.currentTime = c.from;
        }}
        onError={() => {
          setFailed(true);
          setPlaying(false);
        }}
      />
    </div>
  );
}
