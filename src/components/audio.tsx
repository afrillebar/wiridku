"use client";

import { useEffect, useState } from "react";
import type { AudioInfo } from "@/lib/content";

// Saving a recording on the device for offline use, and the lookups the reader needs (a saved copy, a fresh link).

// ---------- offline cache ----------

const AUDIO_CACHE = "wiridku-audio";
// ponytail: synthetic same-origin keys, because signed URLs change on every page build but the file does not;
// the kind (recording or synthetic) is part of the key so saving one never counts as an outdated copy of the other
export const keyFor = (a: Pick<AudioInfo, "path" | "version" | "synthetic">) => `/offline-audio/${a.path}?v=${a.version}&s=${a.synthetic ? 1 : 0}`;
const folderOf = (path: string) => `/offline-audio/${path.split("/")[0]}/`;

async function cachedKeys(path: string, synthetic: boolean): Promise<string[]> {
  if (!("caches" in window)) return [];
  const cache = await caches.open(AUDIO_CACHE);
  const folder = folderOf(path);
  return (await cache.keys())
    .map((r) => new URL(r.url).pathname + new URL(r.url).search)
    .filter((k) => k.startsWith(folder) && k.endsWith(`&s=${synthetic ? 1 : 0}`));
}

export async function cachedBlob(key: string): Promise<Blob | null> {
  if (!("caches" in window)) return null;
  const res = await (await caches.open(AUDIO_CACHE)).match(key);
  return res ? res.blob() : null;
}

export async function freshUrl(slug: string): Promise<string | null> {
  const res = await fetch(`/api/audio-url?slug=${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { url?: string }).url ?? null;
}

export type Track = { slug: string; title: string; audio: AudioInfo };

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
