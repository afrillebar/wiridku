"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { paintFill, useAudioClock, type Clip } from "@/lib/audio-clock";
import type { DoaAudio } from "@/lib/doa";

// One audio element that plays a list of readings, each made of one or more clips (a clip is a stretch of a file, streamed from its source).
// Shared by Doa Harian and Tahlil. The page owns the cards and the list order; this owns the sound, the bottom bar and the end-of-clip watching.

type Options = {
  clips: DoaAudio;
  // the readings that have sound, in the order they follow each other
  queue: { slug: string }[];
  autoNext: boolean;
  titleOf: (slug: string) => string;
  artist: string;
  // called when a reading starts, for the page to open and scroll to its card and to remember it
  onStart?: (slug: string) => void;
};

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function useClipPlayer(o: Options) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const clipRef = useRef<Clip | null>(null);
  const [cur, setCur] = useState<{ slug: string; part: number } | null>(null);
  const curRef = useRef(cur);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  // armed: the playhead has reached the clip; done: the last clip ran out, so Putar starts the reading again
  const armed = useRef(false);
  const done = useRef(false);
  // a failed load is tried again twice before the bar says it failed: the sources (archive.org especially) answer 500 now and then
  const retries = useRef(0);
  const clock = useAudioClock(audioRef, playing, "total", clipRef);
  const opts = useRef(o);
  const finishRef = useRef<() => void>(() => {});
  const stepRef = useRef<(d: -1 | 1) => void>(() => {});

  const play = (slug: string, part = 0) => {
    const a = audioRef.current;
    const clip = opts.current.clips[slug]?.[part];
    if (!a || !clip) return;
    const from = clip.from ?? 0;
    clipRef.current = { from, to: clip.to ?? null };
    curRef.current = { slug, part };
    armed.current = false;
    done.current = false;
    retries.current = 0;
    setCur({ slug, part });
    setFailed(false);
    if (part === 0) opts.current.onStart?.(slug);
    // ponytail: a clip deep inside a surah file would first sound from second 0; mute until the playhead is at the clip
    if (a.src !== clip.url) {
      a.muted = from > 0;
      a.src = clip.url;
    } else a.muted = false;
    try {
      a.currentTime = from;
    } catch {}
    a.play().catch(() => {});
  };

  const finish = () => {
    const a = audioRef.current;
    const c = curRef.current;
    if (!a || !c || !armed.current) return;
    armed.current = false;
    const { clips, queue, autoNext } = opts.current;
    if (c.part + 1 < clips[c.slug].length) return play(c.slug, c.part + 1);
    a.pause();
    done.current = true;
    const i = queue.findIndex((x) => x.slug === c.slug);
    const next = autoNext && i >= 0 ? queue[i + 1] : undefined;
    if (next) play(next.slug);
  };

  const loadFailed = () => {
    const a = audioRef.current;
    const c = curRef.current;
    if (a && c && retries.current < 2) {
      retries.current++;
      setTimeout(() => {
        if (curRef.current !== c) return;
        a.load();
        try {
          a.currentTime = clipRef.current?.from ?? 0;
        } catch {}
        a.play().catch(() => {});
      }, 1500 * retries.current);
      return;
    }
    setFailed(true);
    setPlaying(false);
  };

  // the file ended: that counts as reaching the end of the clip even if the watch never saw the playhead arrive
  const ended = () => {
    armed.current = true;
    finish();
  };

  const step = (d: -1 | 1) => {
    const { queue } = opts.current;
    const i = queue.findIndex((x) => x.slug === curRef.current?.slug);
    const target = i >= 0 ? queue[i + d] : undefined;
    if (target) play(target.slug);
  };

  const toggle = (slug: string) => {
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
    opts.current = o;
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

  // ponytail: Next keeps the page mounted but hidden after navigating away; the sound must not carry on with no way to stop it
  useLayoutEffect(() => {
    const a = audioRef.current;
    return () => a?.pause();
  }, []);

  const slug = cur?.slug;
  const { titleOf, artist } = o;
  useEffect(() => {
    if (!slug || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title: titleOf(slug), artist, album: "Wiridku", artwork: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }] });
    ms.setActionHandler("play", () => void audioRef.current?.play().catch(() => {}));
    ms.setActionHandler("pause", () => audioRef.current?.pause());
    ms.setActionHandler("previoustrack", () => stepRef.current(-1));
    ms.setActionHandler("nexttrack", () => stepRef.current(1));
  }, [slug, titleOf, artist]);

  return { cur, playing, failed, play, toggle, step, wire: { audioRef, clipRef, clock, setPlaying, watch, ended, loadFailed } };
}

export type ClipPlayer = ReturnType<typeof useClipPlayer>;

// The sound itself plus, once something has been started, the bar at the bottom of the screen.
type ViewProps = { wire: ClipPlayer["wire"]; cur: ClipPlayer["cur"]; playing: boolean; failed: boolean; step: ClipPlayer["step"]; toggle: ClipPlayer["toggle"]; queue: { slug: string }[]; title: string; autoNext: boolean; onAutoNext: (on: boolean) => void; label: string };

export function ClipPlayerView({ wire: { audioRef, clipRef, clock, setPlaying, watch, ended, loadFailed }, cur, playing, failed, step, toggle, queue, title, autoNext, onAutoNext, label }: ViewProps) {
  const { rangeRef, nowRef, lastRef, drag } = clock;
  const index = queue.findIndex((x) => x.slug === cur?.slug);
  return (
    <>
      {cur && (
        <div className="qrn-player doa-player" role="region" aria-label={label}>
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
            aria-label="Posisi audio"
          />
          <div className="qrn-player-row">
            <span className="qrn-time">
              <span ref={nowRef}>0:00</span> / <span ref={lastRef}>0:00</span>
            </span>
            <div className="qrn-btns">
              <button type="button" onClick={() => step(-1)} disabled={index <= 0} aria-label="Sebelumnya">
                <Icon>
                  <path d="M6 5v14M18 6l-9 6 9 6z" />
                </Icon>
              </button>
              <button type="button" className="qrn-play" onClick={() => toggle(cur!.slug)} aria-label={playing ? "Jeda" : "Putar"}>
                <Icon size={24}>{playing ? <path d="M8 5v14M16 5v14" /> : <path d="M8 5v14l11-7z" fill="currentColor" />}</Icon>
              </button>
              <button type="button" onClick={() => step(1)} disabled={index < 0 || index >= queue.length - 1} aria-label="Berikutnya">
                <Icon>
                  <path d="M18 5v14M6 6l9 6-9 6z" />
                </Icon>
              </button>
            </div>
            <span className="qrn-now">
              <strong>{title}</strong>
              {failed ? <span role="alert">Audio gagal dimuat</span> : <span>{index >= 0 ? `${index + 1} dari ${queue.length}` : "di luar daftar"}</span>}
              <button type="button" className="doa-auto" aria-pressed={autoNext} onClick={() => onAutoNext(!autoNext)}>
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
        onEnded={ended}
        onTimeUpdate={watch}
        onSeeked={watch}
        onLoadedMetadata={() => {
          const a = audioRef.current;
          const c = clipRef.current;
          // a clip deep in a file: the start position set before loading is not honoured everywhere
          if (a && c && Math.abs(a.currentTime - c.from) > 0.5) a.currentTime = c.from;
        }}
        onError={loadFailed}
      />
    </>
  );
}
