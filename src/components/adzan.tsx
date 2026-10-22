"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { adzanUrl, claimAdzan, claimNotificationAsk, useAdzanPrefs, type AdzanPrefs } from "@/lib/adzan";
import { PRAYERS, type PrayerKey } from "@/lib/prayer";
import { placeName, usePrayerTimes } from "./prayer-card";

// the adzan sounds for this long after its minute starts, so a page that was asleep for a moment still gets it
const WINDOW_MIN = 2;
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
// a tenth of a second of silence (8-bit mono WAV); an empty file may be refused, and then the tap would unlock nothing
const silence = () => {
  const n = 800;
  const b = new Uint8Array(44 + n).fill(0x80);
  const w = (at: number, text: string) => [...text].forEach((c, i) => (b[at + i] = c.charCodeAt(0)));
  const v = new DataView(b.buffer);
  w(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  w(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, "data");
  v.setUint32(40, n, true);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...b))}`;
};

// ---------- the one player and what it is doing, outside React so a tap and a timer can both reach it ----------

type Playing = { key: PrayerKey; label: string; blocked: boolean } | null;
let current: Playing = null;
let player: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();
const setCurrent = (v: Playing) => {
  current = v;
  listeners.forEach((l) => l());
};
const subscribePlaying = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

function getPlayer() {
  if (!player) {
    player = new Audio();
    player.preload = "none";
    player.addEventListener("ended", () => setCurrent(null));
    player.addEventListener("error", () => setCurrent(null));
  }
  return player;
}

// ponytail: browsers only let a page start sound after the visitor did something; playing silence from a tap lets the later, timed adzan start by itself
export function unlockAdzan() {
  const a = getPlayer();
  if (current) return;
  a.src = silence();
  a.muted = true;
  a.play().then(
    () => {
      a.pause();
      a.muted = false;
    },
    () => {
      a.muted = false;
    },
  );
}

export function playAdzan(key: PrayerKey, label: string) {
  for (const el of document.querySelectorAll("audio")) if (el !== player) el.pause();
  const a = getPlayer();
  a.src = adzanUrl(key);
  a.muted = false;
  setCurrent({ key, label, blocked: false });
  a.play().catch(() => setCurrent({ key, label, blocked: true }));
  if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
    navigator.mediaSession.metadata = new MediaMetadata({ title: `Adzan ${label}`, artist: "Mishary Rashid Alafasy", album: "Wiridku", artwork: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }] });
    navigator.mediaSession.setActionHandler("pause", () => stopAdzan());
  }
}

export function stopAdzan() {
  player?.pause();
  setCurrent(null);
}

function resumeAdzan() {
  const a = player;
  if (!a || !current) return;
  a.play().then(() => current && setCurrent({ ...current, blocked: false }), () => {});
}

// ---------- notifications ----------

export const notificationsSupported = () => typeof Notification !== "undefined";

export async function askNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function notifyAdzan(label: string, place: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const options = { body: `Saatnya salat ${label}${place ? ` untuk ${place}` : ""}.`, icon: "/icon-192.png", badge: "/icon-192.png", tag: `adzan-${label}`, data: { url: "/jadwal-salat" } };
  try {
    // Android only shows notifications made by the service worker
    const reg = await navigator.serviceWorker?.ready;
    if (reg) return await reg.showNotification(`Waktu ${label}`, options);
  } catch {}
  try {
    new Notification(`Waktu ${label}`, options);
  } catch {}
}

// Turns the adzan on from a tap: the sound is unlocked and the notification permission asked, both of which browsers allow only from a tap.
export async function enableAdzan(prefs: AdzanPrefs) {
  if (prefs.sound) unlockAdzan();
  if (prefs.notify) await askNotifications();
}

// ---------- in the site frame ----------

function AdzanRunner({ prefs }: { prefs: AdzanPrefs }) {
  const { city, now, t, day } = usePrayerTimes();
  const minute = t.h * 60 + t.min;
  const date = `${t.y}-${t.m}-${t.d}`;
  const place = city ? placeName(city) : "";
  const { sound, notify, prayers } = prefs;
  const seen = useRef<{ date: string; minute: number } | null>(null);

  useEffect(() => {
    if (!now || !day || !(sound || notify)) return;
    const before = seen.current?.date === date ? seen.current.minute : null;
    seen.current = { date, minute };
    for (const p of PRAYERS) {
      if (!prayers[p.key]) continue;
      const at = toMinutes(day[p.key]);
      // a page opened after the time stays quiet; one that was running before it and was only paused (a sleeping tab) still catches up
      const due = minute === at || (before !== null && before < at && minute > at && minute < at + WINDOW_MIN);
      if (!due || !claimAdzan(`${date}-${p.key}`)) continue;
      if (sound) playAdzan(p.key, p.label);
      if (notify) void notifyAdzan(p.label, place);
    }
  }, [now, minute, date, day, place, sound, notify, prayers]);

  return null;
}

function AdzanBar() {
  const playing = useSyncExternalStore(subscribePlaying, () => current, () => null);
  if (!playing) return null;
  return (
    <div className="adzan-bar" role="status">
      <span>
        <strong>Waktu {playing.label}</strong>
        <small>{playing.blocked ? "Browser menahan suara. Ketuk untuk memutar." : "Adzan sedang diputar"}</small>
      </span>
      {playing.blocked ? (
        <button type="button" onClick={resumeAdzan}>
          Putar adzan
        </button>
      ) : (
        <button type="button" onClick={stopAdzan}>
          Hentikan
        </button>
      )}
    </div>
  );
}

// Mounted in the site frame: the adzan sounds at prayer time wherever in the app the visitor is, as long as the page is open.
export function AdzanHost() {
  const prefs = useAdzanPrefs();

  useEffect(() => {
    if (!prefs.on || !(prefs.sound || prefs.notify)) return;
    // the first tap anywhere unlocks the sound (it is locked again after every reload) and, once, asks to show notifications
    const first = () => {
      if (prefs.sound) unlockAdzan();
      if (prefs.notify && notificationsSupported() && Notification.permission === "default" && claimNotificationAsk()) void askNotifications();
    };
    window.addEventListener("pointerdown", first, { once: true });
    return () => window.removeEventListener("pointerdown", first);
  }, [prefs.on, prefs.sound, prefs.notify]);

  return (
    <>
      <AdzanBar />
      {prefs.on && <AdzanRunner prefs={prefs} />}
    </>
  );
}

// ---------- Pengaturan > Adzan ----------

export function usePlaying() {
  return useSyncExternalStore(subscribePlaying, () => current, () => null);
}

export function useNotificationPermission() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported" | "">("");
  useEffect(() => {
    const id = setTimeout(() => setPerm(notificationsSupported() ? Notification.permission : "unsupported"), 0);
    return () => clearTimeout(id);
  }, []);
  return [perm, setPerm] as const;
}

export function AdzanSettings() {
  const a = useAdzanPrefs();
  const playing = usePlaying();
  const [perm, setPerm] = useNotificationPermission();
  const [tested, setTested] = useState(false);

  const askAndRemember = async () => setPerm(await askNotifications());

  return (
    <>
      <section className="set-card">
        <label className="set-switch">
          <span>
            <strong>Adzan di waktu salat</strong>
            <span>Adzan dan notifikasi saat masuk waktu salat di lokasi Anda.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={a.on}
            onChange={(e) => {
              a.set({ on: e.target.checked });
              if (e.target.checked) void enableAdzan(a).then(() => (a.notify ? askAndRemember() : undefined));
            }}
          />
        </label>
        <label className="set-switch">
          <span>
            <strong>Suara adzan</strong>
            <span>Mishary Rashid Alafasy, diputar dari internet.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={a.sound}
            onChange={(e) => {
              a.set({ sound: e.target.checked });
              if (e.target.checked) unlockAdzan();
            }}
          />
        </label>
        <label className="set-switch">
          <span>
            <strong>Notifikasi</strong>
            <span>
              {perm === "denied" ? "Izin notifikasi ditolak. Izinkan di pengaturan browser untuk situs ini." : perm === "unsupported" ? "Browser ini tidak mendukung notifikasi." : "Pemberitahuan di layar saat waktu salat masuk."}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={a.notify}
            onChange={(e) => {
              a.set({ notify: e.target.checked });
              if (e.target.checked) void askAndRemember();
            }}
          />
        </label>
      </section>

      <section className="set-card">
        {PRAYERS.map((p) => (
          <label key={p.key} className="set-switch">
            <span>
              <strong>{p.label}</strong>
            </span>
            <input type="checkbox" role="switch" checked={a.prayers[p.key]} onChange={(e) => a.set({ prayers: { [p.key]: e.target.checked } })} />
          </label>
        ))}
      </section>

      <section className="set-card adzan-test">
        {playing ? (
          <button type="button" className="set-btn" onClick={stopAdzan}>
            Hentikan adzan
          </button>
        ) : (
          <button type="button" className="set-btn" onClick={() => playAdzan("dzuhur", "tes")}>
            Tes suara adzan
          </button>
        )}
        <button
          type="button"
          className="set-btn"
          disabled={perm !== "granted"}
          onClick={() => {
            void notifyAdzan("tes", "");
            setTested(true);
          }}
        >
          Tes notifikasi
        </button>
        {tested && perm === "granted" && <p className="set-note">Notifikasi percobaan dikirim.</p>}
      </section>

      <p className="set-note">
        Berbunyi selama Wiridku terbuka di browser atau aplikasi yang terpasang. Kalau ditutup atau dimatikan sistem (hemat baterai), adzan tidak berbunyi. Waktunya mengikuti{" "}
        <Link href="/pengaturan/lokasi">lokasi</Link>.
      </p>
    </>
  );
}
