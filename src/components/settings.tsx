"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { LocationPicker, cityKey, clearPrayerData, placeName, pretty, useCity, useSavedMonths } from "./prayer-card";
import { saveAutoplay, useAutoplay } from "./audio";
import { clearPlace, clearProgress, useFontStep, useProgressSummary } from "@/lib/progress";
import { zoneByOffset, zoneOf } from "@/lib/prayer";
import { SITE_THEMES, VISITOR_THEME_KEY, type SiteThemeId } from "@/lib/site-theme";

const AUDIO_CACHE = "wiridku-audio";

export function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function SubPage({ title, back = "/pengaturan", children }: { title: string; back?: string; children: ReactNode }) {
  return (
    <div className="sub">
      <header className="sub-head">
        <Link href={back} className="back-btn" aria-label={back === "/" ? "Kembali ke Beranda" : "Kembali ke Pengaturan"} data-tip={back === "/" ? "Kembali ke Beranda" : "Kembali ke Pengaturan"} data-tip-align="start">
          <Icon size={20}>
            <path d="M15 5l-7 7 7 7" />
          </Icon>
        </Link>
        <h1>{title}</h1>
      </header>
      <main className="sub-main">{children}</main>
    </div>
  );
}

// ---------- Pengaturan (menu) ----------

const MENU = [
  { href: "/pengaturan/lokasi", title: "Lokasi & Jadwal Salat", hint: "Kota dan sumber jadwal", icon: <><path d="M12 21s-6-5.4-6-10.5a6 6 0 0 1 12 0C18 15.6 12 21 12 21z" /><circle cx="12" cy="10.5" r="2" /></> },
  { href: "/pengaturan/tampilan", title: "Tampilan", hint: "Tema, ukuran teks, dan bahasa", icon: <><path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" fill="currentColor" /><circle cx="10" cy="7" r="1" fill="currentColor" /><circle cx="14.5" cy="7" r="1" fill="currentColor" /></> },
  { href: "/pengaturan/audio", title: "Audio", hint: "Pemutaran suara bacaan", icon: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></> },
  { href: "/pengaturan/data", title: "Penyimpanan Data", hint: "Progres, jadwal, dan audio tersimpan", icon: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></> },
  { href: "/pengaturan/tentang", title: "Tentang Wiridku", hint: "Versi aplikasi dan sumber data", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></> },
];

export function SettingsMenu() {
  return (
    <ul className="set-list">
      {MENU.map((m) => (
        <li key={m.href}>
          <Link href={m.href} className="set-row">
            <span className="set-icon">
              <Icon>{m.icon}</Icon>
            </span>
            <span className="set-text">
              <strong>{m.title}</strong>
              <span>{m.hint}</span>
            </span>
            <Icon size={18}>
              <path d="m9 6 6 6-6 6" />
            </Icon>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------- Lokasi & Jadwal Salat ----------

export function LocationSettings() {
  const { city, chosen, setCity } = useCity();
  const [saved, setSaved] = useState(false);
  if (!city) return null;
  const zone = city.gps ? zoneByOffset(city.gps.tz) : zoneOf(city.daerah ?? "");
  return (
    <>
      <section className="set-card">
        <p className="set-label">Lokasi untuk jadwal salat</p>
        <p className="set-value">
          {placeName(city)}
          <span>{city.gps ? `${city.daerah ? ` · ${city.daerah}` : ""} · ${zone.label} · via GPS` : city.daerah ? ` · ${pretty(city.daerah)} · ${zone.label}` : ""}</span>
        </p>
        {!chosen && <p className="set-note">Dipilih otomatis dari zona waktu perangkat. Ganti di bawah bila tidak sesuai.</p>}
        {saved && (
          <p className="set-ok" role="status">
            Lokasi disimpan.
          </p>
        )}
        <div className="set-picker">
          <LocationPicker
            current={cityKey(city)}
            onPick={(c) => {
              setCity(c);
              setSaved(true);
            }}
          />
        </div>
      </section>
      <section className="set-card">
        <p className="set-label">Sumber dan metode</p>
        <p className="set-value">Kementerian Agama RI (Bimas Islam)</p>
        <p className="set-note">
          Bila memilih kota, jadwal yang tampil adalah jadwal resmi per kabupaten/kota yang diumumkan Kemenag, diambil lewat api.myquran.com. Bila memakai GPS, waktu dihitung di perangkat dari posisi Anda dengan kriteria Kemenag (Subuh 20°, Isya 18°, ihtiyat 2 menit); dibandingkan dengan jadwal resmi di 20 kota selama 123 hari, tidak pernah meleset lebih dari 1 menit. Waktu ditampilkan dalam zona lokasi itu (WIB, WITA, atau WIT).
        </p>
      </section>
    </>
  );
}

// ---------- Tampilan ----------

const THEME_EVENT = "wiridku-theme";
// "" = follow the site theme; read through useSyncExternalStore so server and first client render agree
const readVisitorTheme = () => {
  try {
    const t = localStorage.getItem(VISITOR_THEME_KEY) ?? "";
    return SITE_THEMES.some((s) => s.id === t) ? t : "";
  } catch {
    return "";
  }
};
const subscribeTheme = (cb: () => void) => {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

export function DisplaySettings({ siteTheme }: { siteTheme: SiteThemeId }) {
  const stored = useSyncExternalStore(subscribeTheme, readVisitorTheme, () => "?");
  const mine = stored === "?" ? undefined : ((stored || null) as SiteThemeId | null);
  const { step, setStep, min, max } = useFontStep();

  const pick = (id: SiteThemeId | null) => {
    try {
      if (id) localStorage.setItem(VISITOR_THEME_KEY, id);
      else localStorage.removeItem(VISITOR_THEME_KEY);
    } catch {}
    document.documentElement.dataset.siteTheme = id ?? siteTheme;
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const site = SITE_THEMES.find((t) => t.id === siteTheme)!;
  return (
    <>
      <section className="set-card">
        <p className="set-label">Tema warna</p>
        <div className="theme-grid" role="radiogroup" aria-label="Tema warna">
          <button type="button" role="radio" aria-checked={mine === null} className="theme-opt" onClick={() => pick(null)}>
            <Swatch colors={site.swatch} />
            <strong>Ikuti situs</strong>
            <span>{site.label}</span>
          </button>
          {SITE_THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={mine === t.id} className="theme-opt" onClick={() => pick(t.id)}>
              <Swatch colors={t.swatch} />
              <strong>{t.label}</strong>
              <span>{t.hint}</span>
            </button>
          ))}
        </div>
        <p className="set-note">Pilihan ini hanya berlaku di perangkat ini.</p>
      </section>

      <section className="set-card">
        <p className="set-label">Ukuran teks Arab</p>
        <p className="arabic set-sample" lang="ar" style={{ "--ar-step": step } as CSSProperties}>
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>
        <div className="set-row-actions">
          <button type="button" className="font-btn" aria-label="Perkecil teks Arab" data-tip="Perkecil teks Arab" data-tip-align="start" disabled={step <= min} onClick={() => setStep(step - 1)}>
            A−
          </button>
          <button type="button" className="font-btn" aria-label="Perbesar teks Arab" data-tip="Perbesar teks Arab" data-tip-align="start" disabled={step >= max} onClick={() => setStep(step + 1)}>
            A+
          </button>
          <button type="button" className="text-btn" disabled={step === 0} onClick={() => setStep(0)}>
            Ukuran awal
          </button>
        </div>
      </section>

      <section className="set-card">
        <p className="set-label">Bahasa</p>
        <p className="set-value">Bahasa Indonesia</p>
        <p className="set-note">Bahasa lain belum tersedia.</p>
      </section>
    </>
  );
}

function Swatch({ colors }: { colors: readonly string[] }) {
  return (
    <span className="swatch" aria-hidden="true">
      {colors.map((c) => (
        <span key={c} style={{ background: c }} />
      ))}
    </span>
  );
}

// ---------- Audio ----------

export function AudioSettings() {
  const auto = useAutoplay();
  return (
    <section className="set-card">
      <label className="set-switch">
        <span>
          <strong>Lanjut otomatis</strong>
          <span>Setelah satu bacaan selesai, putar bacaan berikutnya dan gulir ke kartunya.</span>
        </span>
        <input type="checkbox" role="switch" checked={auto} onChange={(e) => saveAutoplay(e.target.checked)} />
      </label>
      <p className="set-note">Jenis suara (rekaman, suara sintetis, atau YouTube) diatur oleh pengelola situs untuk tiap bacaan.</p>
    </section>
  );
}

// ---------- Penyimpanan Data ----------

async function countOfflineAudio() {
  let files = 0;
  let bytes = 0;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const keys = await cache.keys();
    files = keys.length;
    for (const k of keys) bytes += Number((await cache.match(k))?.headers.get("Content-Length") ?? 0);
  } catch {
    // no Cache Storage (old browser, private mode): nothing is saved offline
  }
  return { files, bytes };
}

function useOfflineAudio() {
  const [info, setInfo] = useState<{ files: number; bytes: number } | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let alive = true;
    countOfflineAudio().then((r) => alive && setInfo(r));
    return () => {
      alive = false;
    };
  }, [round]);
  return { info, refresh: () => setRound((n) => n + 1) };
}

function ClearButton({ label, onClear, disabled }: { label: string; onClear: () => void | Promise<void>; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (asking)
    return (
      <span className="set-confirm">
        <button
          type="button"
          className="danger-btn"
          onClick={async () => {
            await onClear();
            setAsking(false);
          }}
        >
          Ya, hapus
        </button>
        <button type="button" className="text-btn" onClick={() => setAsking(false)}>
          Batal
        </button>
      </span>
    );
  return (
    <button type="button" className="ghost-btn" disabled={disabled} onClick={() => setAsking(true)}>
      {label}
    </button>
  );
}

export function DataSettings() {
  const { done, streak, place } = useProgressSummary();
  const { city, chosen } = useCity();
  const months = useSavedMonths();
  const { info, refresh } = useOfflineAudio();
  const mb = info ? (info.bytes / 1024 / 1024).toFixed(1) : "…";

  const clearAudio = async () => {
    if ("caches" in window) await caches.delete(AUDIO_CACHE);
    refresh();
  };

  return (
    <>
      <p className="set-intro">Semua data di bawah hanya ada di perangkat ini. Wiridku tidak menyimpan progres Anda di server.</p>
      <ul className="data-list">
        <li>
          <span>
            <strong>Progres hari ini dan streak</strong>
            <span>{done} bacaan dicentang hari ini · beruntun {streak} hari</span>
          </span>
          <ClearButton label="Hapus" disabled={!done && !streak} onClear={clearProgress} />
        </li>
        <li>
          <span>
            <strong>Posisi bacaan terakhir</strong>
            <span>{place ? "Tersimpan" : "Belum ada"}</span>
          </span>
          <ClearButton label="Hapus" disabled={!place} onClear={clearPlace} />
        </li>
        <li>
          <span>
            <strong>Lokasi dan jadwal salat</strong>
            <span>
              {city ? placeName(city) : "…"}
              {chosen ? "" : " (otomatis)"}
              {city?.gps ? " · dihitung di perangkat" : ` · ${months} bulan tersimpan`}
            </span>
          </span>
          <ClearButton label="Hapus" disabled={!chosen && !months} onClear={clearPrayerData} />
        </li>
        <li>
          <span>
            <strong>Audio untuk offline</strong>
            <span>{info ? `${info.files} file · ${mb} MB` : "Menghitung…"}</span>
          </span>
          <ClearButton label="Hapus" disabled={!info?.files} onClear={clearAudio} />
        </li>
      </ul>
      <p className="set-note">Pilihan tampilan (tema, ukuran teks) dan lanjut otomatis diatur di menu masing-masing.</p>
    </>
  );
}
