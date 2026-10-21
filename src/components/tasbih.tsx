"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { buzz as haptic } from "@/lib/haptic";

const KEY = "wiridku_tasbih_v1";
const TARGETS = [33, 99, 100, 0] as const; // 0 = no target, count freely
const DZIKIR = [
  { id: "subhanallah", ar: "سُبْحَانَ اللّٰهِ", latin: "Subhanallah", arti: "Maha Suci Allah" },
  { id: "alhamdulillah", ar: "الْحَمْدُ لِلّٰهِ", latin: "Alhamdulillah", arti: "Segala puji bagi Allah" },
  { id: "allahu-akbar", ar: "اللّٰهُ أَكْبَرُ", latin: "Allahu Akbar", arti: "Allah Maha Besar" },
  { id: "la-ilaha", ar: "لَا إِلٰهَ إِلَّا اللّٰهُ", latin: "La ilaha illallah", arti: "Tiada tuhan selain Allah" },
  { id: "istighfar", ar: "أَسْتَغْفِرُ اللّٰهَ", latin: "Astaghfirullah", arti: "Aku memohon ampun kepada Allah" },
  { id: "bebas", ar: "", latin: "Hitung bebas", arti: "Tanpa bacaan tertentu" },
] as const;

type State = { count: number; rounds: number; target: number; dzikir: string; vibrate: boolean };
const DEFAULT: State = { count: 0, rounds: 0, target: 33, dzikir: "subhanallah", vibrate: true };

// ---------- the count lives in localStorage, read through useSyncExternalStore so server and first client render agree ----------
let cache: State | null = null;
const listeners = new Set<() => void>();
const whole = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 1e9 ? v : 0);

const read = (): State => {
  if (!cache) {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      const target = (TARGETS as readonly number[]).includes(s.target) ? s.target : DEFAULT.target;
      cache = {
        count: target && whole(s.count) >= target ? 0 : whole(s.count),
        rounds: whole(s.rounds),
        target,
        dzikir: DZIKIR.some((d) => d.id === s.dzikir) ? s.dzikir : DEFAULT.dzikir,
        vibrate: s.vibrate !== false,
      };
    } catch {
      cache = DEFAULT;
    }
  }
  return cache;
};
const write = (next: State) => {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
};

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const RING = 2 * Math.PI * 88;

export function Tasbih() {
  const s = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const [flash, setFlash] = useState(false);
  const [asking, setAsking] = useState(false);
  const dz = DZIKIR.find((d) => d.id === s.dzikir) ?? DZIKIR[0];
  const total = s.target ? s.rounds * s.target + s.count : s.count;

  const buzz = (pattern: number | number[]) => {
    if (s.vibrate) haptic(pattern);
  };

  const tap = () => {
    setAsking(false);
    if (s.target && s.count + 1 >= s.target) {
      write({ ...s, count: 0, rounds: s.rounds + 1 });
      buzz([70, 50, 140]);
      setFlash(true);
      setTimeout(() => setFlash(false), 1400);
      return;
    }
    write({ ...s, count: s.count + 1 });
    buzz(12);
  };

  const undo = () => {
    setFlash(false);
    if (s.count > 0) write({ ...s, count: s.count - 1 });
    else if (s.target && s.rounds > 0) write({ ...s, rounds: s.rounds - 1, count: s.target - 1 });
  };

  const pickTarget = (target: number) => write({ ...s, target, count: target && s.count >= target ? 0 : s.count });
  const pickDzikir = (id: string) => {
    if (id !== s.dzikir) write({ ...s, dzikir: id, count: 0, rounds: 0 });
    setFlash(false);
  };

  return (
    <div className="tsb">
      <header className="cal-head">
        <Link href="/" className="cal-back" aria-label="Kembali ke Beranda" data-tip="Kembali ke Beranda" data-tip-align="start">
          <Icon>
            <path d="M15 5l-7 7 7 7" />
          </Icon>
        </Link>
        <div>
          <h1>Tasbih</h1>
          <p>
            <span>Penghitung dzikir, tersimpan di perangkat</span>
          </p>
        </div>
      </header>

      <div className="tsb-pick" role="group" aria-label="Bacaan">
        {DZIKIR.map((d) => (
          <button key={d.id} type="button" aria-pressed={d.id === dz.id} onClick={() => pickDzikir(d.id)}>
            {d.id === "bebas" ? "Bebas" : d.latin}
          </button>
        ))}
      </div>

      <section className="tsb-word" aria-label="Bacaan yang dipilih">
        {dz.ar && (
          <p className="tsb-ar" lang="ar" dir="rtl">
            {dz.ar}
          </p>
        )}
        <p className="tsb-latin">{dz.latin}</p>
        <p className="tsb-arti">{dz.arti}</p>
      </section>

      <button type="button" className={`tsb-pad${flash ? " done" : ""}`} onClick={tap} aria-label={`Tambah hitungan, sekarang ${s.count}`}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle className="tsb-track" cx="100" cy="100" r="88" />
          <circle className="tsb-bar" cx="100" cy="100" r="88" strokeDasharray={RING} strokeDashoffset={s.target ? RING * (1 - s.count / s.target) : 0} transform="rotate(-90 100 100)" />
        </svg>
        <span className="tsb-count">{s.count}</span>
        <span className="tsb-of">{s.target ? `dari ${s.target}` : "tanpa target"}</span>
      </button>

      <p className="tsb-status" role="status">
        {flash ? `Satu putaran selesai (${s.target}x). Alhamdulillah.` : s.target ? `Putaran ke-${s.rounds + 1} · total ${total}` : `Total ${total}`}
      </p>
      {s.target > 0 && s.rounds > 0 && !flash && <p className="tsb-rounds">{s.rounds} putaran selesai</p>}

      <div className="tsb-target" role="group" aria-label="Target hitungan">
        <span>Target</span>
        {TARGETS.map((t) => (
          <button key={t} type="button" aria-pressed={t === s.target} onClick={() => pickTarget(t)}>
            {t ? `${t}x` : "Bebas"}
          </button>
        ))}
      </div>

      <div className="tsb-actions">
        <button type="button" onClick={undo} disabled={s.count === 0 && !(s.target && s.rounds > 0)} data-tip="Kurangi satu">
          Kurangi
        </button>
        <button type="button" onClick={() => write({ ...s, vibrate: !s.vibrate })} aria-pressed={s.vibrate} data-tip="Getar tiap hitungan">
          Getar: {s.vibrate ? "nyala" : "mati"}
        </button>
        {asking ? (
          <span className="tsb-confirm">
            <button
              type="button"
              className="danger"
              onClick={() => {
                write({ ...s, count: 0, rounds: 0 });
                setAsking(false);
                setFlash(false);
              }}
            >
              Ya, ulang
            </button>
            <button type="button" onClick={() => setAsking(false)}>
              Batal
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setAsking(true)} disabled={total === 0} data-tip="Mulai dari nol">
            Atur ulang
          </button>
        )}
      </div>
      <p className="tsb-note">Getar di iPhone butuh iOS 17.4 ke atas; di perangkat lain tergantung dukungan browser. Hitungan tetap tersimpan bila halaman ditutup.</p>
    </div>
  );
}
