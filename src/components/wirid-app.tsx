"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Phase, Recitation } from "@/lib/content";
import { useProgress } from "@/lib/progress";
import { AudioBar, AudioButton, AudioProvider, OfflineControl, type Track } from "./audio";
import { InstallPrompt } from "./install-prompt";
import { YoutubeEmbed } from "./youtube-embed";
import { TasbihBox } from "./tasbih-box";
import { track } from "@/lib/track";

const MIN_STEP = -2;
const MAX_STEP = 4;

export function WiridApp({ phases, preview = false }: { phases: Phase[]; preview?: boolean }) {
  const ids = useMemo(() => phases.flatMap((p) => p.recitations.map((r) => r.slug)), [phases]);
  const { done, streak, toggle } = useProgress(ids);
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(phases[0]?.slug);
  const queue = useMemo(
    () => phases.flatMap((p) => p.recitations.flatMap((r): Track[] => (r.audio ? [{ slug: r.slug, title: r.title, audio: r.audio }] : []))),
    [phases],
  );

  useEffect(() => {
    const onScroll = () => {
      const pos = window.scrollY + 130;
      let current = phases[0]?.slug;
      for (const p of phases) {
        const el = document.getElementById(p.slug);
        if (el && el.offsetTop <= pos) current = p.slug;
      }
      setActive(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [phases]);

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
              <button type="button" className="font-btn" aria-label="Perkecil teks Arab" disabled={step <= MIN_STEP} onClick={() => setStep(step - 1)}>
                A−
              </button>
              <button type="button" className="font-btn" aria-label="Perbesar teks Arab" disabled={step >= MAX_STEP} onClick={() => setStep(step + 1)}>
                A+
              </button>
            </div>
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
          Progres harian tersimpan otomatis di perangkat ini agar mudah dilanjutkan konsisten setiap selesai salat.
          <br />
          Disusun untuk penggunaan pribadi.
        </p>
      </footer>

      {!preview && <InstallPrompt />}
    </div>
    </AudioProvider>
  );
}

function Card({ r, done, onToggle }: { r: Recitation; done: boolean; onToggle: () => void }) {
  const isTasbih = r.kind === "tasbih" && r.tasbih_config;
  const showReference = r.reference_text && r.reference_text !== r.chip_label;
  // the data layer only attaches the file for this card's own source, so audio is null for youtube/off
  const track: Track | null = r.audio ? { slug: r.slug, title: r.title, audio: r.audio } : null;

  return (
    <article className={`card${done ? " done" : ""}`} data-slug={r.slug}>
      <div className="card-top">
        <div className="card-title">
          {r.display_number !== null && <span className="card-index">{r.display_number}.</span>}
          <span className="card-name">{r.title}</span>
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
      {showReference && <p className="source">Sumber: {r.reference_text}</p>}
      {track && !track.audio.synthetic && track.audio.reciter && <p className="source">Qari: {track.audio.reciter}</p>}
      {r.source === "youtube" && r.youtube_id && <YoutubeEmbed id={r.youtube_id} start={r.youtube_start} end={r.youtube_end} title={r.title} />}
      {track?.audio.offline && <OfflineControl track={track} />}
    </article>
  );
}
