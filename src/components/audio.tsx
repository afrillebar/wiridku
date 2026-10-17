"use client";

import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AudioInfo } from "@/lib/content";
import { track as trackEvent } from "@/lib/track";

// ---------- offline cache ----------

const AUDIO_CACHE = "wiridku-audio";
// ponytail: synthetic same-origin keys, because signed URLs change on every page build but the file does not;
// the kind (recording or synthetic) is part of the key so saving one never counts as an outdated copy of the other
const keyFor = (a: Pick<AudioInfo, "path" | "version" | "synthetic">) => `/offline-audio/${a.path}?v=${a.version}&s=${a.synthetic ? 1 : 0}`;
const folderOf = (path: string) => `/offline-audio/${path.split("/")[0]}/`;

async function cachedKeys(path: string, synthetic: boolean): Promise<string[]> {
  if (!("caches" in window)) return [];
  const cache = await caches.open(AUDIO_CACHE);
  const folder = folderOf(path);
  return (await cache.keys())
    .map((r) => new URL(r.url).pathname + new URL(r.url).search)
    .filter((k) => k.startsWith(folder) && k.endsWith(`&s=${synthetic ? 1 : 0}`));
}

async function cachedBlob(key: string): Promise<Blob | null> {
  if (!("caches" in window)) return null;
  const res = await (await caches.open(AUDIO_CACHE)).match(key);
  return res ? res.blob() : null;
}

async function freshUrl(slug: string): Promise<string | null> {
  const res = await fetch(`/api/audio-url?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { url?: string }).url ?? null;
}

// ---------- player ----------

export type Track = { slug: string; title: string; audio: AudioInfo };
type Status = "loading" | "playing" | "paused" | "ended" | "error";
type Now = { slug: string; status: Status; time: number; duration: number; error?: string };
type Player = {
  now: Now | null;
  toggle: (t: Track) => void;
  seek: (time: number) => void;
  stop: () => void;
  auto: boolean;
  setAuto: (on: boolean) => void;
};

const PlayerContext = createContext<Player | null>(null);
const AUTO_KEY = "wiridku-autoplay";

// bring the next card under the sticky header
function scrollToCard(slug: string) {
  const card = document.querySelector<HTMLElement>(`[data-slug="${CSS.escape(slug)}"]`);
  if (!card) return;
  const target = () => card.getBoundingClientRect().top + window.scrollY - (document.querySelector<HTMLElement>("header.top")?.offsetHeight ?? 0) - 12;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: target(), behavior: reduce ? "auto" : "smooth" });
  // ponytail: if images or the player resized the page mid-scroll, snap to the card's top once the scroll settles
  window.addEventListener("scrollend", () => Math.abs(target() - window.scrollY) > 4 && window.scrollTo({ top: target() }), { once: true });
}

export function AudioProvider({ children, queue = [] }: { children: ReactNode; queue?: Track[] }) {
  const el = useRef<HTMLAudioElement | null>(null);
  const blobUrl = useRef<string | null>(null);
  const retried = useRef(false);
  const track = useRef<Track | null>(null);
  const [now, setNow] = useState<Now | null>(null);
  // ponytail: safe to read storage up front, the toggle only renders after a tap so hydration never sees it
  const [auto, setAutoState] = useState(() => {
    try {
      return typeof window === "undefined" || localStorage.getItem(AUTO_KEY) !== "0";
    } catch {
      return true;
    }
  });
  // ponytail: the ended listener is bound once, so it reads the live queue/setting/start through refs
  const scrollTo = useRef<string | null>(null);
  const live = useRef<{ queue: Track[]; auto: boolean; start: (t: Track) => void }>({ queue, auto, start: () => {} });

  const setAuto = useCallback((on: boolean) => {
    setAutoState(on);
    try {
      localStorage.setItem(AUTO_KEY, on ? "1" : "0");
    } catch {}
  }, []);

  const patch = (p: Partial<Now>) => setNow((n) => (n ? { ...n, ...p } : n));

  const audio = useCallback(() => {
    if (el.current) return el.current;
    const a = new Audio();
    a.preload = "none";
    a.addEventListener("playing", () => patch({ status: "playing", error: undefined }));
    a.addEventListener("pause", () => setNow((n) => (n && n.status !== "ended" && n.status !== "error" ? { ...n, status: "paused" } : n)));
    a.addEventListener("ended", () => {
      const { queue, auto, start } = live.current;
      if (track.current) trackEvent("complete", track.current.slug);
      const i = queue.findIndex((q) => q.slug === track.current?.slug);
      const next = auto && i >= 0 ? queue[i + 1] : undefined;
      if (!next) return patch({ status: "ended" });
      scrollTo.current = next.slug;
      start(next);
    });
    a.addEventListener("waiting", () => patch({ status: "loading" }));
    a.addEventListener("timeupdate", () => patch({ time: a.currentTime }));
    a.addEventListener("loadedmetadata", () => Number.isFinite(a.duration) && patch({ duration: a.duration }));
    a.addEventListener("error", async () => {
      const t = track.current;
      // ponytail: one retry with a fresh signed URL covers links that expired while the tab stayed open
      if (t && !retried.current && navigator.onLine && !blobUrl.current) {
        retried.current = true;
        const url = await freshUrl(t.slug);
        if (url) {
          a.src = url;
          a.play().catch(() => {});
          return;
        }
      }
      patch({
        status: "error",
        error: navigator.onLine ? "Audio gagal diputar. Coba lagi nanti." : "Tidak ada koneksi dan audio ini belum disimpan offline.",
      });
    });
    el.current = a;
    return a;
  }, []);

  const start = useCallback(
    async (t: Track) => {
      const a = audio();
      a.pause();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = null;
      retried.current = false;
      track.current = t;
      setNow({ slug: t.slug, status: "loading", time: 0, duration: t.audio.duration ?? 0 });
      trackEvent("play", t.slug);

      let blob = await cachedBlob(keyFor(t.audio)).catch(() => null);
      if (!blob && !navigator.onLine) {
        // offline and only an older version saved: better the old recording than silence
        const older = (await cachedKeys(t.audio.path, t.audio.synthetic).catch(() => []))[0];
        if (older) blob = await cachedBlob(older).catch(() => null);
      }
      if (blob) {
        blobUrl.current = URL.createObjectURL(blob);
        a.src = blobUrl.current;
      } else if (!navigator.onLine) {
        // ponytail: Chrome can leave the element buffering forever offline, so say it plainly instead of waiting for an error event
        setNow({ slug: t.slug, status: "error", time: 0, duration: 0, error: "Tidak ada koneksi dan audio ini belum disimpan offline." });
        return;
      } else {
        const url = t.audio.url ?? (await freshUrl(t.slug));
        if (!url) {
          setNow({ slug: t.slug, status: "error", time: 0, duration: 0, error: "Audio belum bisa diambil. Coba lagi nanti." });
          return;
        }
        a.src = url;
      }
      a.play().catch((e: Error) => {
        if (e.name !== "AbortError") setNow({ slug: t.slug, status: "error", time: 0, duration: 0, error: "Browser menolak memutar audio." });
      });
    },
    [audio],
  );
  useEffect(() => {
    live.current = { queue, auto, start };
  }, [queue, auto, start]);

  // ponytail: scroll only after the old card's player has collapsed, or the target moves out from under us
  const slug = now?.slug;
  useEffect(() => {
    if (!slug || scrollTo.current !== slug) return;
    scrollTo.current = null;
    const id = requestAnimationFrame(() => scrollToCard(slug));
    return () => cancelAnimationFrame(id);
  }, [slug]);

  const toggle = useCallback(
    (t: Track) => {
      const a = el.current;
      if (!a || now?.slug !== t.slug || now.status === "error") return void start(t);
      if (now.status === "playing" || now.status === "loading") a.pause();
      else if (now.status === "ended") {
        a.currentTime = 0;
        a.play().catch(() => {});
      } else a.play().catch(() => {});
    },
    [now, start],
  );

  const seek = useCallback((time: number) => {
    if (el.current) el.current.currentTime = time;
  }, []);

  const stop = useCallback(() => {
    el.current?.pause();
    setNow(null);
  }, []);

  useEffect(
    () => () => {
      el.current?.pause();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );

  return <PlayerContext value={{ now, toggle, seek, stop, auto, setAuto }}>{children}</PlayerContext>;
}

export function usePlayer() {
  const p = use(PlayerContext);
  if (!p) throw new Error("usePlayer must be used inside AudioProvider");
  return p;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Icon({ name }: { name: "play" | "pause" | "replay" | "loading" }) {
  const paths = {
    play: <path d="M8 5v14l11-7z" />,
    pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" />,
    replay: <path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />,
    loading: <path d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6z" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor" className={name === "loading" ? "spin" : undefined}>
      {paths[name]}
    </svg>
  );
}

export function AudioButton({ track }: { track: Track }) {
  const { now, toggle } = usePlayer();
  const noun = track.audio.synthetic ? "suara sintetis" : "audio";
  const mine = now?.slug === track.slug ? now : null;
  const status = mine?.status;
  const icon = status === "playing" ? "pause" : status === "loading" ? "loading" : status === "ended" ? "replay" : "play";
  const label =
    status === "playing"
      ? `Jeda ${noun} ${track.title}`
      : status === "paused"
        ? `Lanjutkan ${noun} ${track.title}`
        : status === "ended"
          ? `Putar ulang ${noun} ${track.title}`
          : status === "loading"
            ? `Memuat ${noun} ${track.title}`
            : `Putar ${noun} ${track.title}`;
  return (
    <button type="button" className={`audio-btn${mine ? " active" : ""}`} aria-label={label} title={label} onClick={() => toggle(track)}>
      <Icon name={icon} />
    </button>
  );
}

const SYNTHETIC_NOTE = "Suara sintetis (TTS), bukan rekaman qari. Pengucapan bisa kurang tepat; ikuti teks di bawah.";

export function AudioBar({ track }: { track: Track }) {
  const { now, seek, auto, setAuto } = usePlayer();
  if (now?.slug !== track.slug) return null;
  if (now.status === "error")
    return (
      <p className="audio-error" role="alert">
        {now.error}
      </p>
    );
  const duration = now.duration || track.audio.duration || 0;
  const cues = track.audio.cues ?? [];
  // ponytail: small lead so the count flips with the first syllable, not after it
  const cue = cues.findLast((c) => c.t <= now.time + 0.15) ?? cues[0];
  return (
    <>
      {cue && (
        <div className="audio-count" aria-live="off">
          <span className="audio-count-label">{cue.label}</span>
          {cue.n > 1 && (
            <span className="audio-count-num">
              <strong>{now.status === "ended" ? cue.n : cue.i}</strong> / {cue.n}
            </span>
          )}
        </div>
      )}
      <div className="audio-bar">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(now.time, duration || 1)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={`Posisi audio ${track.title}`}
        />
        <span className="audio-time">
          {fmt(now.time)} / {duration ? fmt(duration) : "–:––"}
        </span>
        <span className="sr-only" aria-live="polite">
          {now.status === "ended" ? "Audio selesai" : ""}
        </span>
      </div>
      <label className="auto-toggle">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Lanjut otomatis ke bacaan berikutnya
      </label>
      {track.audio.synthetic && <p className="tts-note">{SYNTHETIC_NOTE}</p>}
    </>
  );
}

// ---------- offline save ----------

type OfflineState = "unknown" | "none" | "downloading" | "saved" | "outdated" | "error";

export function OfflineControl({ track }: { track: Track }) {
  const [state, setState] = useState<OfflineState>("unknown");
  const supported = typeof window !== "undefined" && "caches" in window;

  useEffect(() => {
    if (!("caches" in window)) return;
    let alive = true;
    cachedKeys(track.audio.path, track.audio.synthetic)
      .then((keys) => {
        if (!alive) return;
        setState(keys.includes(keyFor(track.audio)) ? "saved" : keys.length ? "outdated" : "none");
      })
      .catch(() => alive && setState("none"));
    return () => {
      alive = false;
    };
  }, [track.audio]);

  const save = async () => {
    setState("downloading");
    try {
      let res = track.audio.url ? await fetch(track.audio.url) : null;
      if (!res?.ok) {
        const url = await freshUrl(track.slug);
        res = url ? await fetch(url) : null;
      }
      if (!res?.ok) throw new Error("download failed");
      const blob = await res.blob();
      if (!blob.size) throw new Error("empty file");

      const cache = await caches.open(AUDIO_CACHE);
      const key = keyFor(track.audio);
      await cache.put(key, new Response(blob, { headers: { "Content-Type": blob.type || "audio/mpeg", "Content-Length": String(blob.size) } }));
      // ponytail: only claim "tersedia offline" after reading the file back from the cache
      const check = await cache.match(key);
      if (!check || (await check.blob()).size !== blob.size) throw new Error("cache verify failed");

      for (const k of await cachedKeys(track.audio.path, track.audio.synthetic)) if (k !== key) await cache.delete(k);
      navigator.storage?.persist?.().catch(() => {});
      setState("saved");
    } catch {
      setState("error");
    }
  };

  const remove = async () => {
    const cache = await caches.open(AUDIO_CACHE);
    for (const k of await cachedKeys(track.audio.path, track.audio.synthetic)) await cache.delete(k);
    setState("none");
  };

  if (!supported || state === "unknown") return null;

  return (
    <div className="offline-row">
      {state === "none" && (
        <button type="button" className="offline-btn" onClick={save}>
          Simpan audio untuk offline
        </button>
      )}
      {state === "downloading" && (
        <span className="offline-status" role="status">
          Mengunduh audio…
        </span>
      )}
      {state === "saved" && (
        <>
          <span className="offline-status ok">✓ Audio tersedia offline</span>
          <button type="button" className="offline-btn subtle" onClick={remove}>
            Hapus dari perangkat
          </button>
        </>
      )}
      {state === "outdated" && (
        <>
          <span className="offline-status">Versi lama tersimpan</span>
          <button type="button" className="offline-btn" onClick={save}>
            Perbarui audio offline
          </button>
        </>
      )}
      {state === "error" && (
        <>
          <span className="offline-status err" role="alert">
            Gagal menyimpan
          </span>
          <button type="button" className="offline-btn" onClick={save}>
            Coba lagi
          </button>
        </>
      )}
    </div>
  );
}
