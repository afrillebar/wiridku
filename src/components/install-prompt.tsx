"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

// the browser offers the install only once per page load, so Pengaturan > Pasang Aplikasi reads it from here
let offered: InstallEvent | null = null;
const watchers = new Set<() => void>();
const setOffered = (e: InstallEvent | null) => {
  offered = e;
  watchers.forEach((w) => w());
};
const watch = (cb: () => void) => {
  watchers.add(cb);
  return () => void watchers.delete(cb);
};

export const useInstallOffer = () => useSyncExternalStore(watch, () => offered, () => null);

export async function installApp() {
  const e = offered;
  if (!e) return;
  setOffered(null);
  await e.prompt();
  await e.userChoice.catch(() => {});
}

export const useInstalled = () =>
  useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(display-mode: standalone)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => isStandalone(),
    () => false,
  );

const DISMISS_KEY = "installPromptDismissedAt";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const recentlyDismissed = () => {
  try {
    const last = localStorage.getItem(DISMISS_KEY);
    return !!last && Date.now() - parseInt(last, 10) < COOLDOWN_MS;
  } catch {
    return false;
  }
};
const markDismissed = () => {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
};

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setOffered(e as InstallEvent);
      if (isStandalone() || recentlyDismissed()) return;
      setEvent(e as InstallEvent);
      setOpen(true);
    };
    const onInstalled = () => {
      setOffered(null);
      setOpen(false);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {}
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const later = () => {
    setOpen(false);
    markDismissed();
  };
  const install = async () => {
    setOpen(false);
    if (event) {
      setOffered(null);
      await event.prompt();
      await event.userChoice.catch(() => {});
    }
    setEvent(null);
    markDismissed();
  };

  return (
    <div className={`install-overlay${open ? " show" : ""}`} role="dialog" aria-modal="true" aria-labelledby="installTitle" aria-hidden={!open}>
      <div className="install-card">
        <div className="install-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="install-icon" />
          <div>
            <p className="install-title" id="installTitle">
              Pasang Wiridku?
            </p>
            <p className="install-sub">Akses lebih cepat dari layar utama</p>
          </div>
        </div>
        <p className="install-body">
          Dengan izin Anda, halaman ini bisa dipasang sebagai aplikasi ringan di perangkat Anda — sehingga bisa dibuka kapan saja,
          lebih cepat, dan tetap terbuka tanpa internet setelah pernah dibuka. Silakan pilih salah satu di bawah ini.
        </p>
        <div className="install-actions">
          <button type="button" className="install-btn secondary" onClick={later} tabIndex={open ? 0 : -1}>
            Nanti Saja
          </button>
          <button type="button" className="install-btn primary" onClick={install} tabIndex={open ? 0 : -1}>
            Pasang Sekarang
          </button>
        </div>
      </div>
    </div>
  );
}
