"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { PRAYERS, zoneByOffset, zoneOf, type DayTimes, type MonthSchedule, type PrayerKey } from "@/lib/prayer";
import { computeDay } from "@/lib/prayer-calc";
import { MONTHS, WEEKDAYS, dayLabel } from "@/lib/calendar";
import { enableAdzan } from "./adzan";
import { useAdzanPrefs } from "@/lib/adzan";
import { PRAYER_ICON, monthKey, placeName, pretty, readMonths, subscribeStore, useCity } from "./prayer-card";

const FIRST_YEAR = 2000;
const LAST_YEAR = 2100;
const COLUMNS = [{ key: "imsak", label: "Imsak" }, ...PRAYERS] as const;
const NO_MONTHS: Record<string, MonthSchedule> = {};
const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

// whole minutes since 1970, so the page re-renders when the day may have changed; 0 on the server
const subscribeMinute = (notify: () => void) => {
  const t = setInterval(notify, 30_000);
  return () => clearInterval(t);
};
const minutes = () => Math.floor(Date.now() / 60_000);

function Icon({ children, size = 20, stroke = 1.9 }: { children: ReactNode; size?: number; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function Bell({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`sched-bell${on ? " on" : ""}`} aria-pressed={on} aria-label={`Adzan ${label}`} data-tip={on ? `Adzan ${label} aktif` : `Aktifkan adzan ${label}`} data-tip-align="end" onClick={onClick}>
      <Icon size={20} stroke={1.8}>
        <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z" />
        <path d="M10 21a2 2 0 0 0 4 0" />
        {!on && <path d="M4 4l16 16" />}
      </Icon>
    </button>
  );
}

export function JadwalBulanan() {
  const { city } = useCity();
  const adzan = useAdzanPrefs();
  const tick = useSyncExternalStore(subscribeMinute, minutes, () => 0);
  const saved = useSyncExternalStore(subscribeStore, readMonths, () => NO_MONTHS);
  const [fetched, setFetched] = useState<Record<string, MonthSchedule>>({});
  const [failedKey, setFailedKey] = useState("");
  const [shown, setShown] = useState<{ y: number; m: number } | null>(null);
  const [mode, setMode] = useState<"harian" | "tabel">("harian");
  const [picked, setPicked] = useState("");

  const zone = city ? (city.gps ? zoneByOffset(city.gps.tz) : zoneOf(city.daerah ?? "")) : null;
  const local = zone && tick ? new Date(tick * 60_000 + zone.offset * 3_600_000) : null;
  const today = local ? `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` : "";
  const nowMin = local ? local.getUTCHours() * 60 + local.getUTCMinutes() : 0;
  const view = shown ?? (local ? { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1 } : null);

  const key = city && !city.gps && view ? monthKey(city.id, view.y, view.m) : "";
  const data = key ? (saved[key] ?? fetched[key]) : undefined;
  const hasData = !!data;
  const cityId = city?.id;
  const vy = view?.y;
  const vm = view?.m;

  useEffect(() => {
    if (!key || hasData || !cityId) return;
    let alive = true;
    // ponytail: viewed months are kept in memory only; the saved cache that the home card (and offline use) relies on is not touched
    fetch(`/api/jadwal?kota=${cityId}&tahun=${vy}&bulan=${vm}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("jadwal"))))
      .then((body: MonthSchedule) => alive && setFetched((f) => ({ ...f, [key]: body })))
      .catch(() => alive && setFailedKey(key));
    return () => {
      alive = false;
    };
  }, [key, hasData, cityId, vy, vm]);

  const gps = city?.gps;
  const rows: DayTimes[] = useMemo(() => {
    if (vy === undefined || vm === undefined) return [];
    if (gps) return Array.from({ length: new Date(Date.UTC(vy, vm, 0)).getUTCDate() }, (_, i) => computeDay(vy, vm, i + 1, gps));
    return data?.jadwal ?? [];
  }, [gps, data, vy, vm]);

  // the day shown in "Harian": the one tapped, else today, else the 1st
  const selected = rows.find((r) => r.date === picked) ?? rows.find((r) => r.date === today) ?? rows[0];

  // the table opens on today's row; the day strip keeps the chosen day in view
  const selectedDate = selected?.date;
  useEffect(() => {
    document.querySelector(mode === "tabel" ? ".sched-today" : ".sched-chip.sel")?.scrollIntoView({ block: mode === "tabel" ? "center" : "nearest", inline: "center" });
  }, [mode, vy, vm, rows.length, selectedDate]);

  const goTo = (by: number) => {
    if (!view) return;
    const at = new Date(Date.UTC(view.y, view.m - 1 + by, 1));
    const y = at.getUTCFullYear();
    if (y >= FIRST_YEAR && y <= LAST_YEAR) {
      setShown({ y, m: at.getUTCMonth() + 1 });
      setPicked("");
    }
  };

  // the bell turns the adzan on (from a tap, which the browser requires for sound and notifications) or switches that one prayer
  const toggleBell = (k: PrayerKey) => {
    if (!adzan.on) {
      adzan.set({ on: true, prayers: { [k]: true } });
      void enableAdzan(adzan);
    } else adzan.set({ prayers: { [k]: !adzan.prayers[k] } });
  };

  const failed = !!key && failedKey === key && !data;
  const isToday = selected?.date === today;
  // the next prayer (not Imsak) of today, as on the home card
  const nextKey = isToday && selected ? PRAYERS.find((p) => toMinutes(selected[p.key]) > nowMin)?.key : undefined;
  const parts = selected ? { y: Number(selected.date.slice(0, 4)), m: Number(selected.date.slice(5, 7)), d: Number(selected.date.slice(8)) } : null;

  return (
    <div className="sched">
      <header className="cal-head">
        <Link href="/" className="cal-back" aria-label="Kembali ke Beranda" data-tip="Kembali ke Beranda" data-tip-align="start">
          <Icon>
            <path d="M15 5l-7 7 7 7" />
          </Icon>
        </Link>
        <div>
          <h1>Jadwal Salat</h1>
          <p>
            <Icon size={14}>
              <path d="M12 21s-6-5.4-6-10.5a6 6 0 0 1 12 0C18 15.6 12 21 12 21z" />
              <circle cx="12" cy="10.5" r="2" />
            </Icon>
            <span>{city && zone ? `${placeName(city)} · ${zone.label}` : " "}</span>
          </p>
        </div>
        <Link href="/pengaturan/lokasi" className="sched-change" data-tip="Ganti lokasi atau pakai GPS" data-tip-align="end">
          Ganti
        </Link>
      </header>

      <div className="cal-nav">
        <button type="button" className="cal-step" onClick={() => goTo(-1)} disabled={!view} aria-label="Bulan sebelumnya" data-tip="Bulan sebelumnya" data-tip-align="start">
          <Icon>
            <path d="M15 5l-7 7 7 7" />
          </Icon>
        </button>
        <button type="button" className="cal-step" onClick={() => goTo(1)} disabled={!view} aria-label="Bulan berikutnya" data-tip="Bulan berikutnya">
          <Icon>
            <path d="M9 5l7 7-7 7" />
          </Icon>
        </button>
        <h2>{view ? `${MONTHS[view.m - 1]} ${view.y}` : " "}</h2>
        <button
          type="button"
          className="cal-today"
          onClick={() => {
            setShown(null);
            setPicked("");
          }}
          data-tip="Kembali ke hari ini"
          data-tip-align="end"
        >
          Hari Ini
        </button>
      </div>

      <div className="sched-seg" role="group" aria-label="Tampilan">
        {(["harian", "tabel"] as const).map((v) => (
          <button key={v} type="button" data-view={v} aria-pressed={mode === v} onClick={() => setMode(v)}>
            {v === "harian" ? "Harian" : "Tabel sebulan"}
          </button>
        ))}
      </div>

      {mode === "harian" && rows.length > 0 && selected && parts && (
        <>
          <div className="sched-strip" role="group" aria-label="Pilih tanggal">
            {rows.map((r) => {
              const d = Number(r.date.slice(8));
              const wd = new Date(Date.UTC(parts.y, parts.m - 1, d)).getUTCDay();
              const cls = ["sched-chip", wd === 0 && "sun", wd === 5 && "fri", r.date === today && "now", r.date === selected.date && "sel"].filter(Boolean).join(" ");
              return (
                <button key={r.date} type="button" className={cls} onClick={() => setPicked(r.date)} aria-pressed={r.date === selected.date} aria-current={r.date === today ? "date" : undefined} aria-label={`${WEEKDAYS[wd]}, ${d} ${MONTHS[parts.m - 1]}`}>
                  <small>{WEEKDAYS[wd].slice(0, 3)}</small>
                  <b>{d}</b>
                </button>
              );
            })}
          </div>

          <section className="sched-day" aria-live="polite">
            <header>
              <p>
                <span>{dayLabel(parts.y, parts.m, parts.d).split(" / ")[0]}</span>
                <span className="sched-sep"> / </span>
                <span className="sched-hijri">{dayLabel(parts.y, parts.m, parts.d).split(" / ")[1]} H</span>
              </p>
              {isToday && <span className="cal-badge">Hari Ini</span>}
            </header>
            <ul>
              {COLUMNS.map((c) => {
                const time = selected[c.key as keyof DayTimes] ?? "--:--";
                const past = isToday && toMinutes(time) <= nowMin;
                const cls = [c.key === "imsak" && "imsak", c.key === nextKey && "next", past && "past"].filter(Boolean).join(" ");
                return (
                  <li key={c.key} className={cls || undefined}>
                    <span className="sched-ic">
                      <Icon size={20} stroke={1.7}>
                        {PRAYER_ICON[c.key]}
                      </Icon>
                    </span>
                    <span className="sched-name">{c.label}</span>
                    <strong>{time}</strong>
                    {c.key !== "imsak" && <Bell on={adzan.on && adzan.prayers[c.key as PrayerKey]} label={c.label} onClick={() => toggleBell(c.key as PrayerKey)} />}
                  </li>
                );
              })}
            </ul>
            <Link href="/pengaturan/adzan" className="sched-adzan">
              {adzan.on ? "Adzan aktif · atur adzan dan notifikasi" : "Aktifkan adzan dan notifikasi"}
            </Link>
          </section>
        </>
      )}

      {mode === "tabel" && (
        <div className="sched-card">
          <table className="sched-table">
            <thead>
              <tr>
                <th scope="col">Tgl</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = Number(r.date.slice(8));
                const weekday = new Date(Date.UTC(Number(r.date.slice(0, 4)), Number(r.date.slice(5, 7)) - 1, d)).getUTCDay();
                const cls = [weekday === 0 && "sun", weekday === 5 && "fri", r.date === today && "sched-today"].filter(Boolean).join(" ");
                return (
                  <tr key={r.date} className={cls || undefined} aria-current={r.date === today ? "date" : undefined}>
                    <th scope="row">
                      <b>{d}</b>
                      <small>{WEEKDAYS[weekday].slice(0, 3)}</small>
                    </th>
                    {COLUMNS.map((c) => (
                      <td key={c.key}>{r[c.key as keyof DayTimes]}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!rows.length && (
        <p className="sched-msg" role="status">
          {failed ? "Jadwal bulan ini belum bisa dimuat. Periksa koneksi internet, lalu coba lagi." : city ? "Memuat jadwal…" : " "}
        </p>
      )}

      {city && (
        <p className="sched-note">
          {city.gps
            ? `Dihitung dari posisi GPS dengan kriteria Kemenag RI (${zone?.label}); selisih sekitar 1 menit dari jadwal resmi.`
            : city.id === "1301" && city.lokasi !== "KOTA JAKARTA"
              ? `Jadwal Kemenag RI untuk seluruh DKI Jakarta (${zone?.label}).`
              : `Jadwal Kemenag RI · ${pretty(city.lokasi)} (${zone?.label}).`}{" "}
          Imsak 10 menit sebelum Subuh.
        </p>
      )}
    </div>
  );
}
