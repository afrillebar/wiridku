"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Phase, Recitation } from "@/lib/content";
import { readPlace, useFontStep, useProgress, writePlace } from "@/lib/progress";
import { AudioBar, AudioButton, AudioProvider, OfflineControl, type Track } from "./audio";
import { InstallPrompt } from "./install-prompt";
import { YoutubeEmbed } from "./youtube-embed";
import { TasbihBox } from "./tasbih-box";
import { splitSurahParts } from "@/lib/surah-parts";
import { track } from "@/lib/track";

export function WiridApp({ phases, preview = false }: { phases: Phase[]; preview?: boolean }) {
  const ids = useMemo(() => phases.flatMap((p) => p.recitations.map((r) => r.slug)), [phases]);
  const { done, streak, toggle } = useProgress(ids);
  const { step, setStep, min: minStep, max: maxStep } = useFontStep();
  const [active, setActive] = useState(phases[0]?.slug);
  const [focus, setFocus] = useState(phases[0]?.slug ?? "");
  const queue = useMemo(
    () => phases.flatMap((p) => p.recitations.flatMap((r): Track[] => (r.audio ? [{ slug: r.slug, title: r.title, audio: r.audio }] : []))),
    [phases],
  );

  useEffect(() => {
    const id = location.hash.slice(1) || (!preview ? readPlace() : null);
    if (!id || !document.getElementById(id)) return;
    document.getElementById(id)?.scrollIntoView();
    setFocus(id);
  }, [preview]);

  useEffect(() => {
    let frame = 0;
    let seenPhase = phases[0]?.slug;
    let seenPlace = phases[0]?.slug ?? "";
    const readPosition = () => {
      frame = 0;
      const pos = window.scrollY + 200;
      let phase = phases[0]?.slug;
      let place = phase ?? "";
      for (const p of phases) {
        const head = document.getElementById(p.slug);
        if (head && head.offsetTop <= pos) {
          phase = p.slug;
          place = p.slug;
        }
        for (const r of p.recitations) {
          const card = document.getElementById(r.slug);
          if (card && card.offsetTop <= pos) place = r.slug;
        }
      }
      if (phase !== seenPhase) {
        seenPhase = phase;
        setActive(phase);
      }
      if (place !== seenPlace) {
        seenPlace = place;
        setFocus(place);
        if (!preview && place) writePlace(place);
      }
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(readPosition);
    };
    frame = requestAnimationFrame(readPosition);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [phases, preview]);

  useEffect(() => {
    if (!preview) track("view");
  }, [preview]);

  useEffect(() => {
    // ponytail: production only, a dev-mode worker would serve stale hot-reload bundles
    if (preview || process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const urls = performance.getEntriesByType("resource").map((e) => e.name);
        reg.active?.postMessage({ type: "cache-assets", urls });
      })
      .catch(() => {});
  }, [preview]);

  return (
    <AudioProvider queue={queue}>
    <div style={{ "--ar-step": step } as CSSProperties}>
      <header className="top">
        <div className="top-inner">
          <div className="title-row">
            <h1>Wiridku</h1>
            <span className="streak" aria-label={`Beruntun ${streak} hari`}>
              🔥 {streak}
            </span>
          </div>
          <p className="subtitle">Rangkaian zikir, ayat perlindungan &amp; munajat — dibaca runtut, sekali duduk.</p>
          <div className="controls-row">
            <nav className="phase-tabs" aria-label="Fase">
              {phases.map((p) => (
                <a key={p.slug} className={`phase-tab${active === p.slug ? " active" : ""}`} href={`#${p.slug}`}>
                  Fase {p.number}
                </a>
              ))}
            </nav>
            <div className="font-ctrl">
              <button type="button" className="font-btn" aria-label="Perkecil teks Arab" disabled={step <= minStep} onClick={() => setStep(step - 1)}>
                A−
              </button>
              <button type="button" className="font-btn" aria-label="Perbesar teks Arab" disabled={step >= maxStep} onClick={() => setStep(step + 1)}>
                A+
              </button>
            </div>
            <label className="jump">
              Langsung ke
              <select
                aria-label="Langsung ke fase atau bacaan"
                value={focus}
                onChange={(event) => {
                  const id = event.target.value;
                  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
                  document.getElementById(id)?.scrollIntoView({ behavior });
                  setFocus(id);
                  if (!preview) writePlace(id);
                }}
              >
                {phases.map((p) => (
                  <optgroup key={p.slug} label={`Fase ${p.number}. ${p.title}`}>
                    <option value={p.slug}>Awal fase {p.number}</option>
                    {p.recitations.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.display_number !== null ? `${r.display_number}. ` : ""}
                        {r.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>

      <main>
        {phases.map((p) => (
          <section key={p.slug} className="phase" id={p.slug}>
            <div className="phase-head">
              <div className="phase-num">{p.number}</div>
              <div className="phase-titles">
                <h2>{p.title}</h2>
                {p.description && <p>{p.description}</p>}
              </div>
            </div>
            <div className="phase-rule" />
            {p.recitations.map((r) => (
              <Card key={r.slug} r={r} done={done.has(r.slug)} onToggle={() => !preview && toggle(r.slug)} />
            ))}
          </section>
        ))}
      </main>

      <footer>
        <div className="rule" />
        <p>
          Bacaan yang sudah selesai dan posisi terakhir tersimpan di perangkat ini, supaya bisa dilanjutkan tanpa mencari dari awal.
          <br />
          Disusun untuk penggunaan pribadi.
        </p>
      </footer>

      {!preview && <InstallPrompt />}
    </div>
    </AudioProvider>
  );
}

function Reading({ r }: { r: Recitation }) {
  const parts = splitSurahParts(r);
  if (!parts) {
    return (
      <>
        {r.arabic_text && (
          <p className="arabic" dir="rtl" lang="ar">
            {r.arabic_text}
          </p>
        )}
        {r.transliteration && <p className="latin">{r.transliteration}</p>}
        {r.translation && (
          <>
            <p className="arti-label">Arti</p>
            <p className="arti">{r.translation}</p>
          </>
        )}
      </>
    );
  }

  return parts.map((part) => (
    <section key={part.name || part.arabic} className="reading">
      {part.name && <p className="reading-name">{part.name}</p>}
      <p className="arabic" dir="rtl" lang="ar">
        {part.arabic}
      </p>
      <p className="latin">{part.latin}</p>
      <p className="arti-label">Arti</p>
      <p className="arti">{part.translation}</p>
    </section>
  ));
}

function Card({ r, done, onToggle }: { r: Recitation; done: boolean; onToggle: () => void }) {
  const isTasbih = r.kind === "tasbih" && r.tasbih_config;
  const showReference = r.reference_text && r.reference_text !== r.chip_label;
  // the data layer only attaches the file for this card's own source, so audio is null for youtube/off
  const track: Track | null = r.audio ? { slug: r.slug, title: r.title, audio: r.audio } : null;

  return (
    <article id={r.slug} className={`card${done ? " done" : ""}`} data-slug={r.slug}>
      <div className="card-top">
        <div className="card-title">
          {r.display_number !== null && <span className="card-index">{r.display_number}.</span>}
          <span className="card-name">{r.title}</span>
          {r.chip_label && <span className="card-sep" aria-hidden="true">–</span>}
          {r.chip_label && <span className="repeat-chip">{r.chip_label}</span>}
        </div>
        <div className="card-actions">
          {track && <AudioButton track={track} />}
          <button type="button" className="check-btn" aria-pressed={done} aria-label={`Tandai selesai: ${r.title}`} onClick={onToggle}>
            ✓
          </button>
        </div>
      </div>
      {track && <AudioBar track={track} />}

      {isTasbih && <TasbihBox steps={r.tasbih_config!.steps} />}
      {isTasbih && <p className="arti-label closing-label">Bacaan penyempurna (1×)</p>}

      <Reading r={r} />
      {showReference && <p className="source">Sumber: {r.reference_text}</p>}
      {r.source === "youtube" && r.youtube_id && <YoutubeEmbed id={r.youtube_id} start={r.youtube_start} end={r.youtube_end} title={r.title} />}
      {track?.audio.offline && <OfflineControl track={track} />}
    </article>
  );
}
