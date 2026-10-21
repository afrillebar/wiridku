"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { LocationPicker, cityKey, clearPrayerData, placeName, pretty, useCity, useSavedMonths } from "./prayer-card";
import { saveAutoplay, useAutoplay } from "./audio";
import { installApp, useInstalled, useInstallOffer } from "./install-prompt";
import { TEXT_DEFAULTS, TEXT_LIMITS, clearPlace, clearProgress, clearQuranPlace, useProgressSummary, useQuranPlace, useTextPrefs } from "@/lib/progress";
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
  { href: "/pengaturan/tampilan", title: "Tampilan", hint: "Tema warna dan bahasa", icon: <><path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" fill="currentColor" /><circle cx="10" cy="7" r="1" fill="currentColor" /><circle cx="14.5" cy="7" r="1" fill="currentColor" /></> },
  { href: "/pengaturan/bacaan", title: "Tampilan Bacaan", hint: "Latin, terjemahan, dan ukuran huruf", icon: <><path d="M3 5.5c2.5-1 5.5-1 8 .5v13c-2.5-1.5-5.5-1.5-8-.5z" /><path d="M21 5.5c-2.5-1-5.5-1-8 .5v13c2.5-1.5 5.5-1.5 8-.5z" /></> },
  { href: "/pengaturan/audio", title: "Audio", hint: "Pemutaran suara bacaan", icon: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></> },
  { href: "/pengaturan/pasang", title: "Pasang Aplikasi", hint: "Taruh Wiridku di layar utama", icon: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19h14" /></> },
  { href: "/pengaturan/data", title: "Penyimpanan Data", hint: "Progres, jadwal, dan audio tersimpan", icon: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></> },
  { dialog: "data", title: "Informasi Data", hint: "Sumber teks, jadwal, kalender, dan audio", icon: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></> },
  { dialog: "privasi", title: "Kebijakan Privasi", hint: "Data yang disimpan dan yang dikirim", icon: <><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" /><path d="m9 12 2 2 4-4" /></> },
  { href: "/pengaturan/tentang", title: "Tentang Wiridku", hint: "Versi dan fitur aplikasi", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></> },
] as const;

// ---------- what the two dialogs say ----------
export const SOURCES = [
  ["Ayat Al-Qur'an", "Dicocokkan dengan mushaf Tanzil (api.alquran.cloud)."],
  ["Mushaf dan murotal", "Teks Utsmani, terjemah Kementerian Agama RI, murotal, dan waktu tiap ayat dari Quran.com. Bacaan latin dari equran.id."],
  ["Hadis", "Dicocokkan dengan kitab hadis yang dirujuk di tiap bacaan."],
  ["Jadwal salat", "Kementerian Agama RI (Bimas Islam), lewat api.myquran.com."],
  ["Lokasi GPS", "Waktu salat dihitung di perangkat Anda dengan kriteria Kemenag. Nama daerahnya dicari lewat BigDataCloud dan OpenStreetMap."],
  ["Kalender", "Tanggal Hijriah mengikuti kalender Umm al-Qura, jadi bisa berbeda satu hari dari penetapan pemerintah. Pasaran Jawa dihitung dari tanggal."],
  ["Arah Kiblat", "Dihitung dari koordinat Anda ke Ka'bah, tanpa layanan luar."],
  ["Audio", "Rekaman dari sumber terbuka. Bacaan yang memakai suara sintetis diberi tanda."],
] as const;

export const PRIVACY = [
  ["Tersimpan di perangkat", "Progres, posisi bacaan, lokasi, hitungan tasbih, dan pengaturan hanya ada di perangkat Anda. Tidak ada akun pengunjung."],
  ["Izin lokasi", "Saat pertama kali membuka situs lewat https, browser meminta izin lokasi satu kali. Jika diizinkan, kartu jadwal langsung memakai daerah Anda. Jika ditolak, Anda tidak ditanya lagi dan bisa memilih kota sendiri."],
  ["Koordinat", "Waktu salat dan arah Kiblat dihitung di perangkat. Untuk mencari nama daerah, koordinat (dibulatkan sekitar 100 m) dikirim sekali ke BigDataCloud, dengan OpenStreetMap sebagai cadangan. Wiridku tidak menyimpannya."],
  ["Statistik kunjungan", "Situs mencatat kunjungan dan pemutaran audio dengan kode acak. Alamat IP tidak disimpan; hanya perkiraan negara dan kota dari IP, serta kode yang berganti tiap hari. Jika Anda memberi izin lokasi, nama daerah (tanpa koordinat) ikut dicatat."],
] as const;

const DIALOGS = {
  data: { title: "Informasi Data", items: SOURCES },
  privasi: { title: "Kebijakan Privasi", items: PRIVACY },
} as const;

export function AboutList({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <dl className="about-list">
      {items.map(([title, text]) => (
        <div key={title}>
          <dt>{title}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}

// A centred dialog like the ones in other prayer apps: title, a close cross, the content, one OK button.
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const ok = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ok.current?.focus();
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = lock;
    };
  }, []);

  // ponytail: Tab stays inside the dialog, as a modal dialog should
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab") return;
    const stops = box.current?.querySelectorAll<HTMLElement>("button, input");
    if (!stops?.length) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="dlg-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title" ref={box} onKeyDown={keys}>
        <div className="dlg-head">
          <h2 id="dlg-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Tutup" data-tip="Tutup" data-tip-align="end" onClick={onClose}>
            <Icon size={22}>
              <path d="M6 6l12 12M18 6 6 18" />
            </Icon>
          </button>
        </div>
        <div className="dlg-body">{children}</div>
        <div className="dlg-foot">
          <button type="button" className="dlg-ok" ref={ok} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoDialog({ title, items, onClose }: { title: string; items: readonly (readonly [string, string])[]; onClose: () => void }) {
  return (
    <Dialog title={title} onClose={onClose}>
      <AboutList items={items} />
    </Dialog>
  );
}

export function SettingsMenu() {
  const [open, setOpen] = useState<keyof typeof DIALOGS | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const close = () => {
    setOpen(null);
    opener.current?.focus();
  };
  return (
    <>
      <ul className="set-list">
        {MENU.map((m) => {
          const inner = (
            <>
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
            </>
          );
          return (
            <li key={m.title}>
              {"href" in m ? (
                <Link href={m.href} className="set-row">
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  className="set-row"
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    opener.current = e.currentTarget;
                    setOpen(m.dialog);
                  }}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {open && <InfoDialog title={DIALOGS[open].title} items={DIALOGS[open].items} onClose={close} />}
    </>
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

// ---------- Tampilan Bacaan ----------

type SizeKind = "arab" | "latin" | "arti";
const SIZES: readonly { kind: SizeKind; label: string; title: string }[] = [
  { kind: "arab", label: "Teks Arab", title: "Ukuran teks Arab" },
  { kind: "latin", label: "Latin", title: "Ukuran teks latin" },
  { kind: "arti", label: "Terjemahan", title: "Ukuran terjemahan" },
];

// the slider shows what the reader will look like, as it moves
function SizeDialog({ kind, onClose }: { kind: SizeKind; onClose: () => void }) {
  const p = useTextPrefs();
  const [lo, hi] = TEXT_LIMITS[kind];
  const value = p[kind];
  const title = SIZES.find((s) => s.kind === kind)!.title;
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="size-preview" style={{ "--ar-size": `${p.arab}px`, "--latin-size": `${p.latin}px`, "--arti-size": `${p.arti}px` } as CSSProperties}>
        {kind === "arab" && (
          <p className="arabic" dir="rtl" lang="ar">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
        )}
        {kind === "latin" && <p className="latin">Bismillahirrahmanirrahim</p>}
        {kind === "arti" && (
          <>
            <p className="arti-label">Arti</p>
            <p className="arti">Dengan nama Allah Yang Maha Pengasih, Maha Penyayang.</p>
          </>
        )}
      </div>
      <div className="size-ctrl">
        <button type="button" className="font-btn" aria-label="Perkecil" disabled={value <= lo} onClick={() => p.set({ [kind]: value - 1 })}>
          A−
        </button>
        <input type="range" min={lo} max={hi} step={1} value={value} aria-label={title} aria-valuetext={`${value} piksel`} onChange={(e) => p.set({ [kind]: Number(e.target.value) })} />
        <button type="button" className="font-btn" aria-label="Perbesar" disabled={value >= hi} onClick={() => p.set({ [kind]: value + 1 })}>
          A+
        </button>
      </div>
      <p className="size-value">
        <span>
          Ukuran <output>{value}</output>
        </span>
        <button type="button" className="text-btn" disabled={value === TEXT_DEFAULTS[kind]} onClick={() => p.set({ [kind]: TEXT_DEFAULTS[kind] })}>
          Ukuran awal
        </button>
      </p>
    </Dialog>
  );
}

export function ReadingSettings() {
  const p = useTextPrefs();
  const [open, setOpen] = useState<SizeKind | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const close = () => {
    setOpen(null);
    opener.current?.focus();
  };
  return (
    <>
      <section className="set-card">
        <p className="set-label">Konten</p>
        <label className="set-switch">
          <span>
            <strong>Latin</strong>
            <span>Tampilkan bacaan latin (transliterasi)</span>
          </span>
          <input type="checkbox" role="switch" checked={p.showLatin} onChange={(e) => p.set({ showLatin: e.target.checked })} />
        </label>
        <label className="set-switch">
          <span>
            <strong>Terjemahan</strong>
            <span>Tampilkan arti dalam bahasa Indonesia</span>
          </span>
          <input type="checkbox" role="switch" checked={p.showArti} onChange={(e) => p.set({ showArti: e.target.checked })} />
        </label>
        <p className="set-note">Perubahan langsung berlaku di halaman Wirid Salat. Per kata dan mushaf belum tersedia.</p>
      </section>

      <section className="set-card">
        <p className="set-label">Ukuran</p>
        <ul className="size-list">
          {SIZES.map((s) => (
            <li key={s.kind}>
              <button
                type="button"
                className="size-row"
                aria-haspopup="dialog"
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setOpen(s.kind);
                }}
              >
                <strong>{s.label}</strong>
                {((s.kind === "latin" && !p.showLatin) || (s.kind === "arti" && !p.showArti)) && <em>disembunyikan</em>}
                <b>{p[s.kind]}</b>
                <Icon size={18}>
                  <path d="m9 6 6 6-6 6" />
                </Icon>
              </button>
            </li>
          ))}
        </ul>
        <p className="set-note">Ketuk salah satu untuk mengatur ukurannya dengan penggeser, lengkap dengan pratinjau.</p>
      </section>
      {open && <SizeDialog kind={open} onClose={close} />}
    </>
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

// ---------- Pasang Aplikasi ----------

const INSTALL_STEPS = [
  ["iPhone dan iPad", "Buka Wiridku di Safari. Ketuk tombol Bagikan (kotak dengan panah ke atas), pilih Tambah ke Layar Utama, lalu ketuk Tambah."],
  ["Android (Chrome)", "Buka Wiridku di Chrome. Ketuk menu titik tiga di pojok kanan atas, pilih Instal aplikasi (atau Tambahkan ke layar utama), lalu ketuk Instal."],
  ["Komputer (Chrome atau Edge)", "Klik ikon pasang di ujung kanan bilah alamat, atau buka menu titik tiga lalu pilih Instal Wiridku, kemudian klik Instal."],
] as const;

export function InstallSettings() {
  const installed = useInstalled();
  const offer = useInstallOffer();
  return (
    <>
      <section className="set-card">
        <p className="set-label">Status</p>
        <p className="set-value">{installed ? "Sudah terpasang di perangkat ini" : "Belum terpasang"}</p>
        {!installed && offer && (
          <button type="button" className="set-btn" onClick={installApp}>
            Pasang sekarang
          </button>
        )}
        {!installed && !offer && <p className="set-note">Ikuti langkah sesuai perangkat Anda di bawah.</p>}
      </section>
      <p className="set-intro">Setelah dipasang, Wiridku muncul di layar utama seperti aplikasi biasa dan terbuka tanpa bilah alamat. Halaman yang pernah dibuka tetap bisa dibaca tanpa internet. Tanpa toko aplikasi dan tanpa biaya.</p>
      <AboutList items={INSTALL_STEPS} />
      <p className="set-note">Di iPhone, aplikasi dari layar utama bisa menyimpan data terpisah dari Safari, jadi progres, lokasi, dan hitungan tasbih mulai dari awal. Untuk melepas, hapus ikonnya seperti aplikasi lain.</p>
    </>
  );
}

export function DataSettings() {
  const { done, streak, place } = useProgressSummary();
  const quranPlace = useQuranPlace();
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
            <strong>Posisi murotal Al-Qur&apos;an</strong>
            <span>{quranPlace ? `Surah ke-${quranPlace.surah}, ayat ${quranPlace.ayah}` : "Belum ada"}</span>
          </span>
          <ClearButton label="Hapus" disabled={!quranPlace} onClear={clearQuranPlace} />
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
