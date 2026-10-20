"use client";

import Link from "next/link";
import { useEffect, useMemo, type ReactNode } from "react";
import { usePlace, useProgress } from "@/lib/progress";
import { PrayerCard } from "./prayer-card";

export type DashboardPhase = { slug: string; title: string; cards: { slug: string; title: string; number: number | null }[] };


function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONS = {
  book: (
    <>
      <path d="M3 5.5c2.5-1 5.5-1 8 .5v13c-2.5-1.5-5.5-1.5-8-.5z" />
      <path d="M21 5.5c-2.5-1-5.5-1-8 .5v13c2.5-1.5 5.5-1.5 8-.5z" />
    </>
  ),
  // a loop of prayer beads (dotted ring) with the end bead hanging below
  beads: (
    <>
      <circle cx="12" cy="10" r="6.5" strokeDasharray="0.01 3.4" strokeWidth="2.8" />
      <path d="M12 16.5v2" />
      <circle cx="12" cy="20" r="1.4" />
    </>
  ),
  // open hand holding a heart (same shape as the Lucide "hand-heart" icon)
  hands: (
    <>
      <path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" />
      <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
      <path d="m2 15 6 6" />
      <path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z" />
    </>
  ),
  // compass with the north half of the needle filled
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 5.5 14.4 12h-4.8z" fill="currentColor" />
      <path d="M9.6 12h4.8L12 18.5z" />
    </>
  ),
  // calendar page with a crescent: the Hijri month
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 9.5h16" />
      <path d="M14.2 16.6a3.2 3.2 0 1 1-1.6-5.4 2.6 2.6 0 0 0 1.6 5.4z" />
    </>
  ),
  // mosque: dome, crescent finial and doorway
  mosque: (
    <>
      <path d="M12 4.5V3M10.8 3.6a1.3 1.3 0 0 0 2.4 0" />
      <path d="M6 20v-7a6 6 0 0 1 12 0v7" />
      <path d="M3 20h18" />
      <path d="M10 20v-3a2 2 0 0 1 4 0v3" />
    </>
  ),
  // gear (Lucide "settings")
  gear: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

// Only features that exist are links; the others are planned stages and say so instead of linking to an empty page.
const MENU = [
  { name: "Wirid Salat", icon: ICONS.book, href: "/wirid-salat" },
  { name: "Tasbih", icon: ICONS.beads },
  { name: "Doa Harian", icon: ICONS.hands },
  { name: "Arah Kiblat", icon: ICONS.compass },
  { name: "Kalender", icon: ICONS.calendar, href: "/kalender" },
  { name: "Jadwal Salat", icon: ICONS.mosque, href: "/jadwal-salat" },
];

export function Dashboard({ phases }: { phases: DashboardPhase[] }) {
  const ids = useMemo(() => phases.flatMap((p) => p.cards.map((c) => c.slug)), [phases]);
  const { done, streak } = useProgress(ids);
  const place = usePlace();

  useEffect(() => {
    // old links pointed at the reading page on "/", e.g. "/#f1-1"; send them to where the cards live now
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash && (ids.includes(hash) || phases.some((p) => p.slug === hash))) location.replace(`/wirid-salat#${hash}`);
  }, [ids, phases]);

  const finished = ids.filter((id) => done.has(id)).length;
  const total = ids.length;
  const lastCard = phases.flatMap((p) => p.cards).find((c) => c.slug === place);
  const lastPhase = phases.find((p) => p.slug === place);
  const resume = lastCard ? `${lastCard.number !== null ? `${lastCard.number}. ` : ""}${lastCard.title}` : lastPhase?.title;

  const pct = total ? Math.round((finished / total) * 100) : 0;

  return (
    <div className="home">
      <header className="home-bar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={40} height={40} className="home-logo" />
        <div className="home-brand">
          <p className="home-name">Wiridku</p>
          <p className="home-tag">Teman ibadah sehari-hari</p>
        </div>
        <Link href="/pengaturan" className="icon-btn" aria-label="Pengaturan" data-tip="Pengaturan" data-tip-align="end">
          <Icon>{ICONS.gear}</Icon>
        </Link>
      </header>

      <PrayerCard />

      <nav className="menu-sheet" aria-label="Fitur">
        {MENU.map((m) => {
          const inner = (
            <>
              <span className="menu-icon">
                <Icon size={28}>{m.icon}</Icon>
              </span>
              <span className="menu-label">{m.name}</span>
              {!m.href && <span className="menu-soon">Segera</span>}
            </>
          );
          return m.href ? (
            <Link key={m.name} href={m.href} className="menu-item">
              {inner}
            </Link>
          ) : (
            <div key={m.name} className="menu-item off" aria-disabled="true">
              {inner}
            </div>
          );
        })}
      </nav>

      <section className="today" aria-labelledby="today-title">
        <div className="today-head">
          <div>
            <h1 id="today-title">Wirid Hari Ini</h1>
            <p>Centang bacaan yang sudah selesai setelah salat.</p>
          </div>
          <span className="today-pct">{pct}%</span>
        </div>
        <p className="today-count">
          <strong>
            {finished} dari {total} bacaan
          </strong>
          {streak > 0 ? ` · beruntun ${streak} hari` : ""}
        </p>
        <div className="segbar" role="progressbar" aria-label="Bacaan selesai hari ini" aria-valuemin={0} aria-valuemax={total} aria-valuenow={finished}>
          {ids.map((id) => (
            <span key={id} className={done.has(id) ? "on" : undefined} />
          ))}
        </div>
        {resume && <p className="today-last">Terakhir dibaca: {resume}</p>}
        <Link className="today-btn" href={place ? `/wirid-salat#${place}` : "/wirid-salat"}>
          {resume ? "Lanjutkan Wirid" : "Mulai Wirid"}
        </Link>
      </section>
    </div>
  );
}
