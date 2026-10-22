"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAudioClock, type Clip } from "@/lib/audio-clock";
import type { DoaAudio } from "@/lib/doa";
import { clipLines } from "@/lib/reading";

// One audio element for a page of readings. A reading's sound is a list of clips (a stretch of a file, streamed from its source);
// a clip with marks holds several lines. This owns the element, the clip being played, the line being read, and the watching for the end of a clip.
// The page owns everything that is seen.

type Options = {
  clips: DoaAudio;
  titleOf: (slug: string) => string;
  artist: string;
  // the last clip of a reading has run out
  onEnded: (slug: string) => void;
  // a reading starts to play from its first clip
  onPlay?: (slug: string) => void;
  // asked for a new link when a clip does not load (a signed link may have expired); the page then puts it into `clips`
  refresh?: (slug: string) => Promise<unknown>;
};

export type ClipPlayer = ReturnType<typeof useClipPlayer>;

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
  // a failed load is tried again twice before the player says it failed: the sources (archive.org especially) answer 500 now and then
  const retries = useRef(0);
  // whether the visitor asked for sound, so that a retry after a failed load only plays when they did
  const wanted = useRef(false);
  // the line being read (-1 before any) and how many lines come before the clip loaded
  const [line, setLine] = useState(-1);
  const lineRef = useRef(-1);
  const base = useRef(0);
  // the count a recording says, for a repeated dzikir: which repetition of how many
  // where the playhead is meant to be when a clip is opened
  const startRef = useRef(0);
  const { rangeRef, nowRef, lastRef, drag } = useAudioClock(audioRef, playing, "total", clipRef);
  const opts = useRef(o);
  const finishRef = useRef<() => void>(() => {});
  const stepRef = useRef<(d: -1 | 1) => void>(() => {});

  // Loads a clip and puts the playhead on `at` (a second in its file); with go, it starts to play.
  const open = (slug: string, part: number, at: number | null, go: boolean) => {
    const a = audioRef.current;
    const list = opts.current.clips[slug];
    const clip = list?.[part];
    if (!a || !clip) return;
    const from = clip.from ?? 0;
    const start = Math.min(Math.max(at ?? from, from), clip.to ?? Infinity);
    clipRef.current = { from, to: clip.to ?? null };
    startRef.current = start;
    curRef.current = { slug, part };
    armed.current = false;
    done.current = false;
    retries.current = 0;
    if (go && part === 0) opts.current.onPlay?.(slug);
    base.current = list.slice(0, part).reduce((n, c) => n + (c.marks?.length ?? 1), 0);
    const marks = clip.marks;
    const first = marks ? Math.max(0, marks.findLastIndex((m) => m <= start + 0.05)) : 0;
    lineRef.current = base.current + first;
    setLine(lineRef.current);
    setCur({ slug, part });
    setFailed(false);
    // ponytail: a clip deep inside a surah file would first sound from second 0; mute until the playhead is at the clip
    if (a.src !== clip.url) {
      a.muted = go && start > 0;
      a.src = clip.url;
    } else a.muted = false;
    try {
      a.currentTime = start;
    } catch {}
    wanted.current = go;
    if (go) a.play().catch(() => {});
  };

  // where line n of a reading is: which clip, and the second in its file
  const where = (slug: string, n: number) => {
    const list = opts.current.clips[slug] ?? [];
    let first = 0;
    for (let part = 0; part < list.length; part++) {
      const marks = list[part].marks;
      const count = marks?.length ?? 1;
      if (n < first + count) return { part, at: marks ? marks[n - first] : (list[part].from ?? 0) };
      first += count;
    }
    return { part: 0, at: list[0]?.from ?? 0 };
  };

  const play = (slug: string, n = 0) => {
    const w = where(slug, n);
    open(slug, w.part, w.at, true);
  };
  // gets a reading ready (clip loaded, playhead on the place) without a sound
  const load = (slug: string, part = 0, at: number | null = null) => open(slug, part, at, false);

  // the same, at line n of the reading
  const loadLine = (slug: string, n: number) => {
    const w = where(slug, n);
    open(slug, w.part, w.at, false);
  };

  const finish = () => {
    const a = audioRef.current;
    const c = curRef.current;
    if (!a || !c || !armed.current) return;
    armed.current = false;
    const clips = opts.current.clips[c.slug];
    if (c.part + 1 < clips.length) return open(c.slug, c.part + 1, null, true);
    a.pause();
    done.current = true;
    opts.current.onEnded(c.slug);
  };

  // the file ended: that counts as reaching the end of the clip even if the watch never saw the playhead arrive
  const ended = () => {
    armed.current = true;
    finish();
  };

  const loadFailed = () => {
    const a = audioRef.current;
    const c = curRef.current;
    if (a && c && retries.current < 2) {
      retries.current++;
      const first = retries.current === 1;
      const again = () => {
        if (curRef.current !== c) return;
        // the clips of the page may have a new link by now
        const clip = opts.current.clips[c.slug]?.[c.part];
        if (clip && a.src !== new URL(clip.url, location.href).href) a.src = clip.url;
        else a.load();
        try {
          a.currentTime = startRef.current;
        } catch {}
        if (wanted.current) a.play().catch(() => {});
      };
      if (first && opts.current.refresh) opts.current.refresh(c.slug).finally(() => setTimeout(again, 400));
      else setTimeout(again, 1500 * retries.current);
      return;
    }
    setFailed(true);
    setPlaying(false);
  };

  // to the previous or next line of the reading
  const step = (d: -1 | 1) => {
    const c = curRef.current;
    if (!c) return;
    const total = clipLines(opts.current.clips[c.slug]);
    play(c.slug, Math.min(total - 1, Math.max(0, lineRef.current + d)));
  };

  const toggle = () => {
    const a = audioRef.current;
    const c = curRef.current;
    if (!a || !c) return;
    if (!a.paused) {
      wanted.current = false;
      a.pause();
    } else if (done.current) play(c.slug, 0);
    else {
      wanted.current = true;
      a.play().catch(() => {});
    }
  };

  // the end of a clip, the unmuting once the playhead has arrived and the line being read are watched every frame and on every timeupdate
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
    const at = curRef.current;
    const marks = at && opts.current.clips[at.slug]?.[at.part]?.marks;
    if (marks) {
      // the last line that has started
      let lo = 0;
      let hi = marks.length - 1;
      let found = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (marks[mid] <= t) {
          found = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      if (base.current + found !== lineRef.current) {
        lineRef.current = base.current + found;
        setLine(lineRef.current);
      }
    }
    if (c.to !== null && t >= c.to) finishRef.current();
  };

  // for saving the place: the clip, the second in its file and the line
  const snapshot = () => {
    const a = audioRef.current;
    const c = curRef.current;
    return a && c ? { slug: c.slug, part: c.part, t: a.currentTime, line: Math.max(0, lineRef.current) } : null;
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

  // the handlers of the <audio> element, spread onto it by the page
  const audioProps = {
    preload: "metadata" as const,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEmptied: () => setPlaying(false),
    onEnded: ended,
    onTimeUpdate: watch,
    onSeeked: watch,
    onLoadedMetadata: () => {
      const a = audioRef.current;
      // a clip deep in a file: the start position set before loading is not honoured everywhere
      if (a && !armed.current && Math.abs(a.currentTime - startRef.current) > 0.5) a.currentTime = startRef.current;
    },
    onError: loadFailed,
  };

  return { cur, line, playing, failed, play, load, loadLine, toggle, step, snapshot, audioRef, clipRef, rangeRef, nowRef, lastRef, drag, audioProps };
}
