import { useCallback, useEffect, useRef, type PointerEvent, type RefObject } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
export function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// colours the played part of the bar; --p is read by the track gradient
export function paintFill(r: HTMLInputElement) {
  const max = Number(r.max);
  r.style.setProperty("--p", max ? `${(Number(r.value) / max) * 100}%` : "0%");
}

// Paints the seek bar and its two time labels straight into the DOM, once per frame while playing.
// Keeping the time in React state re-rendered the whole player four times a second and made the bar step instead of glide.
// end shows the whole length ("now / total") or what is left ("-remaining").
// clip: when only a part of the file is the thing playing (a doa cut out of a surah), the bar and labels cover just that part
export type Clip = { from: number; to: number | null };
export function useAudioClock(audioRef: RefObject<HTMLAudioElement | null>, playing: boolean, end: "total" | "left", clip?: RefObject<Clip | null>) {
  const rangeRef = useRef<HTMLInputElement>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const lastRef = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    let raf = 0;
    const paint = () => {
      const whole = Number.isFinite(a.duration) ? a.duration : 0;
      const c = clip?.current;
      const from = c?.from ?? 0;
      const d = c ? Math.max(0, (c.to ?? whole) - from) : whole;
      const t = c ? Math.min(d, Math.max(0, a.currentTime - from)) : a.currentTime;
      const r = rangeRef.current;
      if (r) {
        if (r.max !== String(d)) {
          r.max = String(d);
          r.disabled = !d;
        }
        // while the thumb is held, the thumb is the truth
        if (!dragging.current) {
          r.value = String(t);
          paintFill(r);
        }
      }
      const a1 = clock(t);
      if (nowRef.current && nowRef.current.textContent !== a1) {
        nowRef.current.textContent = a1;
        r?.setAttribute("aria-valuetext", `${a1} dari ${clock(d)}`);
      }
      const a2 = end === "left" ? `-${clock(d - t)}` : clock(d);
      if (lastRef.current && lastRef.current.textContent !== a2) lastRef.current.textContent = a2;
    };
    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };
    if (playing) loop();
    else paint();
    const events = ["loadedmetadata", "durationchange", "seeked", "timeupdate", "emptied"] as const;
    for (const e of events) a.addEventListener(e, paint);
    return () => {
      cancelAnimationFrame(raf);
      for (const e of events) a.removeEventListener(e, paint);
    };
  }, [audioRef, clip, playing, end]);

  const hold = useCallback(() => void (dragging.current = true), []);
  const release = useCallback((e: PointerEvent<HTMLInputElement>) => {
    dragging.current = false;
    paintFill(e.currentTarget);
  }, []);

  return { rangeRef, nowRef, lastRef, drag: { onPointerDown: hold, onPointerUp: release, onPointerCancel: release } };
}
