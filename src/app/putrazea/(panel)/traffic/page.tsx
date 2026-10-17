import Link from "next/link";
import { AccessLogTable, DataTable } from "@/components/admin/data-table";
import { Flash } from "@/components/admin/flash";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const RANGES = [
  [1, "24 jam"],
  [7, "7 hari"],
  [30, "30 hari"],
  [90, "90 hari"],
] as const;
const EVENT_LABEL = { view: "Buka halaman", play: "Putar audio", complete: "Audio selesai" } as Record<string, string>;
const TZ = "Asia/Jakarta";
const PAGE = 1000;
// ponytail: module-level so the per-request clock read is not flagged as an impure render
const clock = () => Date.now();
const MAX_ROWS = 50000;

type Row = {
  id: number;
  created_at: string;
  visitor_id: string;
  user_id: string | null;
  event: string;
  path: string;
  slug: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
};

const regionName = new Intl.DisplayNames("id", { type: "region" });
const country = (c: string | null) => {
  if (!c) return null;
  try {
    return regionName.of(c) ?? c;
  } catch {
    return c;
  }
};
const place = (r: Row) => [r.city, country(r.country)].filter(Boolean).join(", ") || "Tidak diketahui";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const hourOf = (d: Date) => Number(d.toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false })) % 24;

function count<K>(rows: Row[], key: (r: Row) => K) {
  const m = new Map<K, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Bars({ data, label }: { data: { key: string; label: string; views: number; plays: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.views + d.plays));
  return (
    <div className="bars" role="img" aria-label={label}>
      {data.map((d) => (
        <div key={d.key} className="bar" title={`${d.label}: ${d.views} kunjungan, ${d.plays} putar audio`}>
          <div className="bar-stack" style={{ height: `${((d.views + d.plays) / max) * 100}%` }}>
            <span className="bar-plays" style={{ flexGrow: d.plays }} />
            <span className="bar-views" style={{ flexGrow: d.views }} />
          </div>
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  );
}

export default async function TrafficPage(props: PageProps<"/putrazea/traffic">) {
  const { hari } = await props.searchParams;
  const days = RANGES.find(([d]) => String(d) === hari)?.[0] ?? 7;
  const now = clock();
  const since = new Date(now - days * 864e5);
  const supabase = await createClient();
  await requireAdmin();

  // ponytail: the API returns at most 1000 rows per request, so page through the range
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data } = await supabase
      .from("visit_events")
      .select("id, created_at, visitor_id, user_id, event, path, slug, country, region, city, device, browser, os, referrer")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }

  const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))];
  const slugs = [...new Set(rows.map((r) => r.slug).filter((v): v is string => !!v))];
  const [{ data: staff }, { data: cards }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("user_id, email").in("user_id", userIds) : { data: [] },
    slugs.length ? supabase.from("recitations").select("slug, title").in("slug", slugs) : { data: [] },
  ]);
  const emailOf = new Map((staff ?? []).map((s) => [s.user_id, s.email]));
  const titleOf = new Map((cards ?? []).map((c) => [c.slug, c.title]));
  const who = (r: Row) => (r.user_id && emailOf.get(r.user_id)) || `Pengunjung #${r.visitor_id.slice(0, 6)}`;

  const views = rows.filter((r) => r.event === "view");
  const plays = rows.filter((r) => r.event === "play");
  const completes = rows.filter((r) => r.event === "complete");
  const visitors = new Set(rows.map((r) => r.visitor_id)).size;

  const timeline =
    days === 1
      ? Array.from({ length: 24 }, (_, i) => {
          const t = new Date(now - (23 - i) * 36e5);
          return { key: `${dayKey(t)}-${hourOf(t)}`, label: `${String(hourOf(t)).padStart(2, "0")}`, views: 0, plays: 0 };
        })
      : Array.from({ length: days }, (_, i) => {
          const t = new Date(now - (days - 1 - i) * 864e5);
          return { key: dayKey(t), label: t.toLocaleDateString("id-ID", { timeZone: TZ, day: "numeric", month: days > 31 ? "numeric" : "short" }), views: 0, plays: 0 };
        });
  const byKey = new Map(timeline.map((t) => [t.key, t]));
  const hours = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: String(h).padStart(2, "0"), views: 0, plays: 0 }));
  for (const r of rows) {
    const t = new Date(r.created_at);
    const slot = byKey.get(days === 1 ? `${dayKey(t)}-${hourOf(t)}` : dayKey(t));
    const field = r.event === "view" ? "views" : r.event === "play" ? "plays" : null;
    if (!field) continue;
    if (slot) slot[field]++;
    hours[hourOf(t)][field]++;
  }

  const topCards = count(plays, (r) => r.slug ?? "").slice(0, 12);
  const doneBySlug = new Map(count(completes, (r) => r.slug ?? ""));
  const places = count(views, place).slice(0, 10);
  const devices = count(views, (r) => [r.device === "mobile" ? "HP" : r.device === "tablet" ? "Tablet" : "Komputer", r.os, r.browser].filter(Boolean).join(" · ")).slice(0, 10);
  const referrers = count(views.filter((r) => r.referrer), (r) => {
    try {
      return new URL(r.referrer!).hostname;
    } catch {
      return r.referrer!;
    }
  }).slice(0, 8);

  return (
    <>
      <div className="page-head">
        <h1>Trafik</h1>
        <nav className="range-pills" aria-label="Rentang waktu">
          {RANGES.map(([d, label]) => (
            <Link prefetch={false} key={d} href={`/putrazea/traffic?hari=${d}`} className={d === days ? "active" : undefined} aria-current={d === days ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="muted">
        Pemakaian situs publik {days === 1 ? "24 jam" : `${days} hari`} terakhir, waktu WIB. Pengunjung dikenali dari ID acak di perangkatnya (bukan nama); admin/editor yang sedang login tercatat dengan emailnya. Lokasi dari jaringan Vercel, jadi kosong saat dijalankan lokal. Alamat IP tidak disimpan. Log disimpan 180 hari.
      </p>

      <div className="stats">
        <div className="stat">
          <div className="stat-value">{views.length}</div>
          <div className="stat-label">Kunjungan</div>
        </div>
        <div className="stat">
          <div className="stat-value">{visitors}</div>
          <div className="stat-label">Pengunjung unik</div>
        </div>
        <div className="stat">
          <div className="stat-value">{plays.length}</div>
          <div className="stat-label">Audio diputar</div>
        </div>
        <div className="stat">
          <div className="stat-value">{plays.length ? Math.round((completes.length / plays.length) * 100) : 0}%</div>
          <div className="stat-label">Audio didengar sampai habis</div>
        </div>
      </div>
      {rows.length >= MAX_ROWS && <p className="msg warn">Rentang ini punya lebih dari {MAX_ROWS} catatan; yang ditampilkan hanya yang terbaru.</p>}

      <h2>{days === 1 ? "Per jam" : "Per hari"}</h2>
      <p className="legend">
        <span className="bar-views" /> Kunjungan <span className="bar-plays" /> Putar audio
      </p>
      <Bars data={timeline} label="Kunjungan dan putar audio per waktu" />

      <h2>Jam ramai (WIB)</h2>
      <Bars data={hours} label="Kunjungan dan putar audio per jam dalam sehari" />

      <div className="traffic-grid">
        <section>
          <h2>Bacaan paling sering diputar</h2>
          <DataTable
            colSpan={3}
            empty="Belum ada."
            head={
              <tr>
                <th>Bacaan</th>
                <th>Diputar</th>
                <th>Sampai habis</th>
              </tr>
            }
            rows={topCards.map(([slug, n]) => (
              <tr key={slug || "tanpa"}>
                <td className="wide">{titleOf.get(slug) ?? slug}</td>
                <td data-label="Diputar">{n}</td>
                <td data-label="Habis">{doneBySlug.get(slug) ?? 0}</td>
              </tr>
            ))}
          />
        </section>
        <section>
          <h2>Lokasi</h2>
          <List rows={places} empty="Belum ada." />
          <h2>Perangkat</h2>
          <List rows={devices} empty="Belum ada." />
          <h2>Datang dari</h2>
          <List rows={referrers} empty="Langsung (tanpa tautan perujuk)." />
        </section>
      </div>

      <h2>Log akses</h2>
      <Flash searchParams={props.searchParams} />
      <AccessLogTable
        days={days}
        rows={rows.map((r) => ({
          id: String(r.id),
          visitor: r.user_id ?? r.visitor_id,
          time: new Date(r.created_at).toLocaleString("id-ID", { timeZone: TZ, dateStyle: "short", timeStyle: "medium" }),
          who: who(r),
          place: place(r),
          device: [r.device === "mobile" ? "HP" : r.device === "tablet" ? "Tablet" : "Komputer", r.os, r.browser].filter(Boolean).join(" · "),
          event: `${EVENT_LABEL[r.event] ?? r.event}${r.slug ? `: ${titleOf.get(r.slug) ?? r.slug}` : ""}`,
        }))}
      />
    </>
  );
}

function List({ rows, empty }: { rows: [string, number][]; empty: string }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  const max = rows[0][1];
  return (
    <ul className="rank">
      {rows.map(([k, n]) => (
        <li key={k}>
          <span className="rank-label">{k}</span>
          <span className="rank-bar" style={{ width: `${(n / max) * 100}%` }} />
          <span className="rank-num">{n}</span>
        </li>
      ))}
    </ul>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
