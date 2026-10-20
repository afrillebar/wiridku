"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { HIJRI_MONTHS, HIJRI_YEARS, MONTHS, WEEKDAYS, dayInfo, fromHijri, hijriRange, hijriText, markers, type DayInfo } from "@/lib/calendar";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const FIRST_YEAR = 1900;
const LAST_YEAR = 2100;
const SHORT = ["Aha", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// today on this device; "" while rendering on the server
const subscribeDay = (notify: () => void) => {
  const t = setInterval(notify, 60_000);
  return () => clearInterval(t);
};
const today = () => {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth() + 1, n.getDate());
};

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const MOON = <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />;

export function Kalender() {
  const now = useSyncExternalStore(subscribeDay, today, () => "");
  const [shownMonth, setShownMonth] = useState<{ y: number; m: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [jump, setJump] = useState(false);
  const [jumpError, setJumpError] = useState("");
  const [jumpMode, setJumpMode] = useState<"masehi" | "hijriah">("masehi");
  const touch = useRef<{ x: number; y: number } | null>(null);

  const view = shownMonth ?? (now ? { y: Number(now.slice(0, 4)), m: Number(now.slice(5, 7)) } : null);
  const selected = picked ?? now;

  const vy = view?.y;
  const vm = view?.m;
  const cells = useMemo(() => {
    if (vy === undefined || vm === undefined) return [];
    const lead = new Date(Date.UTC(vy, vm - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
    return Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
      const d = new Date(Date.UTC(vy, vm - 1, 1 - lead + i));
      const info = dayInfo(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      return { ...info, marks: markers(info), out: d.getUTCMonth() + 1 !== vm };
    });
  }, [vy, vm]);

  const goTo = (y: number, m: number) => {
    const at = new Date(Date.UTC(y, m - 1, 1));
    const ny = at.getUTCFullYear();
    if (ny >= FIRST_YEAR && ny <= LAST_YEAR) setShownMonth({ y: ny, m: at.getUTCMonth() + 1 });
  };
  const step = (by: number) => view && goTo(view.y, view.m + by);
  const toToday = () => {
    setShownMonth(null);
    setPicked(null);
  };
  // "Cari tanggal": any month and year (and optionally a day), in the Masehi or the Hijri calendar
  const resolve = (form: FormData): { target: { y: number; m: number; d: number }; typedDay: boolean } | { error: string } => {
    const y = Number(String(form.get("y")).trim());
    const m = Number(form.get("m"));
    const dRaw = String(form.get("d") ?? "").trim();
    const d = dRaw === "" ? 0 : Number(dRaw);
    if (jumpMode === "hijriah") {
      if (!Number.isInteger(y) || y < HIJRI_YEARS[0] || y > HIJRI_YEARS[1]) return { error: `Tahun Hijriah harus berupa angka antara ${HIJRI_YEARS[0]} dan ${HIJRI_YEARS[1]}.` };
      if (dRaw !== "" && (!Number.isInteger(d) || d < 1 || d > 30)) return { error: "Tanggal Hijriah berupa angka 1-30. Kosongkan untuk tanggal 1." };
      const hit = fromHijri(y, m, d);
      if (!hit) return { error: `${HIJRI_MONTHS[m - 1]} ${y} H hanya punya 29 hari. Kosongkan tanggal atau isi 1-29.` };
      if (hit.y < FIRST_YEAR || hit.y > LAST_YEAR) return { error: `Tanggal itu di luar rentang kalender (${FIRST_YEAR}-${LAST_YEAR} M).` };
      return { target: hit, typedDay: true };
    }
    if (!Number.isInteger(y) || y < FIRST_YEAR || y > LAST_YEAR) return { error: `Tahun harus berupa angka antara ${FIRST_YEAR} dan ${LAST_YEAR}.` };
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (dRaw !== "" && (!Number.isInteger(d) || d < 1 || d > days)) return { error: `${MONTHS[m - 1]} ${y} hanya punya ${days} hari. Kosongkan tanggal atau isi 1-${days}.` };
    return { target: { y, m, d: d || 1 }, typedDay: d > 0 };
  };

  // live: used while typing, so half-typed years are skipped quietly; submit: errors are shown and the panel closes
  const search = (form: FormData, live: boolean) => {
    const r = resolve(form);
    if ("error" in r) return live ? undefined : setJumpError(r.error);
    setJumpError("");
    if (!live) setJump(false);
    setShownMonth({ y: r.target.y, m: r.target.m });
    // Masehi without a day: the 1st, or today when that month is the current one; otherwise the date found
    setPicked(jumpMode === "masehi" && !r.typedDay && now.slice(0, 7) === `${r.target.y}-${pad(r.target.m)}` ? null : iso(r.target.y, r.target.m, r.target.d));
  };

  const pick = (c: DayInfo & { out: boolean }) => {
    setPicked(iso(c.y, c.m, c.d));
    if (c.out) goTo(c.y, c.m);
  };

  const midHijri = view ? dayInfo(view.y, view.m, 15).hijri : { day: 1, month: 1, year: HIJRI_YEARS[0] };
  const chosen = selected ? dayInfo(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)), Number(selected.slice(8, 10))) : null;

  const chosenMarks = chosen ? markers(chosen) : [];

  // holy days of the month shown; the three tasyrik days read as one line
  const events = cells
    .filter((c) => !c.out)
    .flatMap((c) => c.marks.filter((k) => k.kind === "besar").map((k) => ({ d: c.d, label: k.label })))
    .reduce<{ label: string; from: number; to: number }[]>((acc, e) => {
      const last = acc[acc.length - 1];
      if (last && last.label === e.label && last.to === e.d - 1) last.to = e.d;
      else acc.push({ label: e.label, from: e.d, to: e.d });
      return acc;
    }, []);

  return (
    <div className="cal">
      <header className="cal-head">
        <Link href="/" className="cal-back" aria-label="Kembali ke Beranda" data-tip="Kembali ke Beranda" data-tip-align="start">
          <Icon>
            <path d="M15 5l-7 7 7 7" />
          </Icon>
        </Link>
        <div>
          <h1>Kalender Masehi, Hijriah &amp; Jawa</h1>
          <p>
            <Icon size={14}>{MOON}</Icon>
            <span>{view ? `${hijriRange(view.y, view.m)} H` : " "}</span>
          </p>
        </div>
      </header>

      <div className="cal-nav">
        <button type="button" className="cal-step" onClick={() => step(-1)} disabled={!view} aria-label="Bulan sebelumnya" data-tip="Bulan sebelumnya" data-tip-align="start">
          <Icon>
            <path d="M15 5l-7 7 7 7" />
          </Icon>
        </button>
        <button type="button" className="cal-step" onClick={() => step(1)} disabled={!view} aria-label="Bulan berikutnya" data-tip="Bulan berikutnya">
          <Icon>
            <path d="M9 5l7 7-7 7" />
          </Icon>
        </button>
        <h2>
          <button type="button" className="cal-title" onClick={() => setJump((j) => !j)} aria-expanded={jump} disabled={!view} data-tip="Cari tanggal, bulan, atau tahun lain">
            {view ? `${MONTHS[view.m - 1]} ${view.y}` : " "}
            <Icon size={16}>
              <path d="M6 9l6 6 6-6" />
            </Icon>
          </button>
        </h2>
        <button type="button" className="cal-today" onClick={toToday} data-tip="Kembali ke hari ini" data-tip-align="end">
          Hari Ini
        </button>
      </div>
      <button type="button" className="cal-find" onClick={() => setJump((j) => !j)} aria-expanded={jump} disabled={!view}>
        <Icon size={16}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </Icon>
        Cari tanggal, bulan, atau tahun
      </button>
      {jump && view && (
        <form
          key={jumpMode}
          className="cal-jump"
          onSubmit={(e) => {
            e.preventDefault();
            search(new FormData(e.currentTarget), false);
          }}
          onChange={(e) => search(new FormData(e.currentTarget), true)}
          onKeyDown={(e) => e.key === "Escape" && setJump(false)}
        >
          <div className="cal-jump-mode" role="group" aria-label="Kalender">
            {(["masehi", "hijriah"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={jumpMode === k}
                onClick={() => {
                  setJumpMode(k);
                  setJumpError("");
                }}
              >
                {k === "masehi" ? "Masehi" : "Hijriah"}
              </button>
            ))}
          </div>
          <label>
            Tanggal
            <input name="d" inputMode="numeric" placeholder={jumpMode === "masehi" ? "1-31" : "1-30"} autoComplete="off" maxLength={2} />
          </label>
          <label>
            Bulan
            <select name="m" defaultValue={jumpMode === "masehi" ? view.m : midHijri.month}>
              {(jumpMode === "masehi" ? MONTHS : HIJRI_MONTHS).map((n, i) => (
                <option key={n} value={i + 1}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tahun{jumpMode === "hijriah" ? " (H)" : ""}
            <input name="y" inputMode="numeric" defaultValue={jumpMode === "masehi" ? view.y : midHijri.year} autoComplete="off" maxLength={4} autoFocus />
          </label>
          <button type="submit" className="cal-jump-go">
            Lihat
          </button>
          {jumpError && (
            <p className="cal-jump-err" role="alert">
              {jumpError}
            </p>
          )}
        </form>
      )}
      <p className="cal-hint">← Geser kanan / kiri untuk ganti bulan →</p>

      <div
        className="cal-card"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          if (!s) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
        }}
      >
        <div className="cal-week" aria-hidden="true">
          {SHORT.map((w, i) => (
            <span key={w} className={i === 0 ? "sun" : i === 5 ? "fri" : undefined}>
              {w}
            </span>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((c) => {
            const key = iso(c.y, c.m, c.d);
            const cls = ["cal-day", c.out && "out", c.weekday === 0 && "sun", c.weekday === 5 && "fri", key === now && "now", key === selected && "sel"].filter(Boolean).join(" ");
            return (
              <button key={key} type="button" className={cls} onClick={() => pick(c)} aria-pressed={key === selected} aria-current={key === now ? "date" : undefined} aria-label={[`${WEEKDAYS[c.weekday]} ${c.pasaran}, ${c.d} ${MONTHS[c.m - 1]} ${c.y}, ${hijriText(c.hijri)} H`, ...c.marks.map((k) => k.label)].join(", ")}>
                <span className="cal-num">{c.d}</span>
                <span className="cal-pas">{c.pasaran}</span>
                <span className="cal-dots" aria-hidden="true">
                  {c.marks.filter((k) => k.kind !== "jumat").map((k) => (
                    <i key={k.kind} className={`cal-dot ${k.kind}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="cal-legend" aria-label="Keterangan">
        <li>
          <i className="cal-dot besar" /> Hari besar Islam
        </li>
        <li>
          <i className="cal-dot puasa" /> Sunnah Puasa Senin-Kamis
        </li>
        <li>
          <i className="cal-dot bidh" /> Sunnah Puasa Ayyamul Bidh (tanggal Hijriah 13-15)
        </li>
        <li>
          <b className="cal-key fri">12</b> Hari Jumat
          <b className="cal-key sun">12</b> Hari Ahad
          <b className="cal-key now">12</b> Hari ini
        </li>
      </ul>

      <section className="cal-events" aria-label="Hari besar Islam bulan ini">
        <h3>Hari besar Islam bulan ini</h3>
        {events.length ? (
          <ul>
            {events.map((e) => (
              <li key={e.label + e.from}>
                <i className="cal-dot besar" />
                <b>{e.from === e.to ? e.from : `${e.from}-${e.to}`} {view ? MONTHS[view.m - 1] : ""}</b>
                <span>{e.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Tidak ada hari besar Islam di bulan ini.</p>
        )}
      </section>

      {chosen && (
        <section className="cal-detail" aria-live="polite">
          <p className="cal-detail-date">
            <strong>
              {WEEKDAYS[chosen.weekday]} {chosen.pasaran}, {chosen.d} {MONTHS[chosen.m - 1]} {chosen.y}
            </strong>
            {iso(chosen.y, chosen.m, chosen.d) === now && <span className="cal-badge">Hari Ini</span>}
          </p>
          <p className="cal-detail-row">
            <span className="cal-hijri">
              <Icon size={16}>{MOON}</Icon>
              {hijriText(chosen.hijri)} H
            </span>
            <span className="cal-chip">
              Pasaran: <b>{chosen.pasaran}</b> (Neptu: {chosen.neptu})
            </span>
          </p>
          {chosenMarks.length > 0 && (
            <ul className="cal-marks">
              {chosenMarks.map((k) => (
                <li key={k.kind}>
                  <i className={`cal-dot ${k.kind}`} /> {k.label}
                </li>
              ))}
            </ul>
          )}
          <p className="cal-note">Tanggal Hijriah mengikuti kalender Umm al-Qura; hari besar dan awal bulan resmi ditetapkan pemerintah (sidang isbat) dan bisa berbeda satu hari.</p>
        </section>
      )}
    </div>
  );
}
