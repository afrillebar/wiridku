"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Prayer } from "@/lib/doa";
import { useTahlilState, useTextPrefs } from "@/lib/progress";
import type { TahlilPart } from "@/lib/tahlil";
import { ClipPlayerView, useClipPlayer } from "./clip-player";
import { DoaCard } from "./doa";

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

// a part is shown with the same card as a doa: Arabic, latin and meaning written line for line
const asPrayer = (p: TahlilPart): Prayer => ({
  id: p.slug,
  slug: p.slug,
  category: "tahlil",
  title: p.title,
  arabic_text: p.lines.map((l) => l.ar).join("\n"),
  transliteration: p.lines.every((l) => l.la) ? p.lines.map((l) => l.la).join("\n") : null,
  translation: p.lines.every((l) => l.ti) ? p.lines.map((l) => l.ti).join("\n") : null,
  reference_text: p.ref,
  note: p.note,
  repeat_label: null,
});

export function Tahlil({ parts }: { parts: TahlilPart[] }) {
  const prefs = useTextPrefs();
  const state = useTahlilState();
  const setState = state.set;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const audio = Object.fromEntries(parts.filter((p) => p.clips.length).map((p) => [p.slug, p.clips]));
  const queue = parts.filter((p) => audio[p.slug]);
  const titleOf = useCallback((slug: string) => parts.find((p) => p.slug === slug)?.title ?? "Tahlil", [parts]);

  // a link such as /tahlil#ayat-kursi opens that card
  useEffect(() => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (!slug || !parts.some((p) => p.slug === slug)) return;
    const t = setTimeout(() => {
      setOpen((o) => new Set(o).add(slug));
      requestAnimationFrame(() => document.getElementById(slug)?.scrollIntoView({ block: "start" }));
    }, 0);
    return () => clearTimeout(t);
  }, [parts]);

  const player = useClipPlayer({
    clips: audio,
    queue,
    autoNext: state.autoNext,
    titleOf,
    artist: "Tahlil & Yasin",
    onStart: (slug) => {
      setState({ slug });
      setOpen((o) => (o.has(slug) ? o : new Set(o).add(slug)));
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => document.getElementById(slug)?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" }), 60);
    },
  });
  const { cur, playing } = player;
  const last = !cur && state.slug ? parts.find((p) => p.slug === state.slug && audio[p.slug]) : undefined;
  const toggle = (slug: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (!n.delete(slug)) n.add(slug);
      return n;
    });

  return (
    <div className={`doa${cur ? " has-player" : ""}`} style={{ "--ar-size": `${prefs.arab}px`, "--latin-size": `${prefs.latin}px`, "--arti-size": `${prefs.arti}px` } as CSSProperties}>
      <header className="cal-head">
        <Link href="/" className="cal-back" aria-label="Kembali ke Beranda" data-tip="Kembali ke Beranda" data-tip-align="start">
          <Icon>
            <path d="M15 5l-7 7 7 7" />
          </Icon>
        </Link>
        <div>
          <h1>Tahlil &amp; Yasin</h1>
          <p>
            <span>{parts.length} bacaan, urut dari Yasin sampai doa</span>
          </p>
        </div>
      </header>

      <p className="tahlil-intro">
        Susunan umum yang dipakai di banyak tempat di Indonesia. Urutan dan tambahan bacaan (mis. bacaan pembuka dan tawasul) bisa berbeda antar daerah, jadi ikuti pemimpin tahlil di majelis Anda.
      </p>

      {last ? (
        <button type="button" className="qrn-resume doa-resume" onClick={() => player.play(last.slug)}>
          <span>
            <small>Terakhir didengar</small>
            <strong>{last.title}</strong>
          </span>
          <span className="qrn-resume-go">Putar</span>
        </button>
      ) : (
        !cur && (
          <button type="button" className="qrn-resume doa-resume" onClick={() => player.play(queue[0].slug)}>
            <span>
              <small>Dengarkan</small>
              <strong>Dari awal, urut sampai doa</strong>
            </span>
            <span className="qrn-resume-go">Putar</span>
          </button>
        )
      )}

      <section className="doa-group" aria-label="Susunan bacaan">
        <h2>
          Susunan bacaan <span>{parts.length}</span>
        </h2>
        {parts.map((p, i) => (
          <DoaCard
            key={p.slug}
            p={asPrayer({ ...p, title: `${i + 1}. ${p.title}` })}
            open={open.has(p.slug)}
            onToggle={() => toggle(p.slug)}
            showLatin={prefs.showLatin}
            showArti={prefs.showArti}
            canPlay={!!audio[p.slug]}
            current={cur?.slug === p.slug}
            playing={playing}
            onPlay={() => player.toggle(p.slug)}
            labels={p.lines.every((l) => l.n) ? p.lines.map((l) => l.n!) : undefined}
          />
        ))}
      </section>

      <p className="doa-note-foot">
        Ukuran huruf, latin, dan terjemahan bisa diatur di <Link href="/pengaturan/bacaan">Pengaturan, Tampilan Bacaan</Link>. Ayat Al-Qur&apos;an, terjemah Kementerian Agama RI, dan murotal Mishary Alafasy dari Quran.com; dzikir dan doa dari Hisnul Muslim (hisnmuslim.com). Audio diputar langsung dari sumbernya, butuh internet.
      </p>

      <ClipPlayerView
        wire={player.wire}
        cur={player.cur}
        playing={player.playing}
        failed={player.failed}
        step={player.step}
        toggle={player.toggle}
        queue={queue}
        title={titleOf(cur?.slug ?? "")}
        autoNext={state.autoNext}
        onAutoNext={(on) => setState({ autoNext: on })}
        label="Pemutar tahlil"
      />
    </div>
  );
}
