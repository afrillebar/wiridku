"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ClipPlayerView, useClipPlayer } from "./clip-player";
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

type CardProps = { p: Prayer; open: boolean; onToggle: () => void; showLatin: boolean; showArti: boolean; canPlay: boolean; current: boolean; playing: boolean; onPlay: () => void; labels?: string[] };

export function DoaCard({ p, open, onToggle, showLatin, showArti, canPlay, current, playing, onPlay, labels }: CardProps) {
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
          {blocks(p).map((b, i, all) => (
            <section key={i} className="doa-line">
              {labels?.length === all.length && <span className="doa-n">{labels[i]}</span>}
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
            {p.arabic_text && (
              <button type="button" className="doa-copy" onClick={copy}>
                <Icon size={16}>
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V6a2 2 0 0 1 2-2h9" />
                </Icon>
                {copied ? "Tersalin" : "Salin"}
              </button>
            )}
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
  const titleOf = useCallback((slug: string) => prayers.find((p) => p.slug === slug)?.title ?? "Doa", [prayers]);
  const player = useClipPlayer({
    clips: audio,
    queue,
    autoNext: doa.autoNext,
    titleOf,
    artist: "Doa Harian",
    onStart: (slug) => {
      setDoa({ slug });
      setOpen((o) => (o.has(slug) ? o : new Set(o).add(slug)));
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => document.getElementById(slug)?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" }), 60);
    },
  });
  const { cur, playing } = player;
  const curSlug = cur?.slug;
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
        <button type="button" className="qrn-resume doa-resume" onClick={() => player.play(last.slug)}>
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
              onPlay={() => player.toggle(p.slug)}
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

      <ClipPlayerView wire={player.wire} cur={player.cur} playing={player.playing} failed={player.failed} step={player.step} toggle={player.toggle} queue={queue} title={titleOf(curSlug ?? "")} autoNext={doa.autoNext} onAutoNext={(on) => setDoa({ autoNext: on })} label="Pemutar doa" />
    </div>
  );
}
