import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { requireStaff } from "@/lib/auth";
import { parseAudioSource, resolveAudioSource } from "@/lib/audio-source";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard(props: PageProps<"/putrazea">) {
  const supabase = await createClient();
  const staffP = requireStaff();
  const head = (table: "phases" | "recitations" | "profiles") => supabase.from(table).select("*", { count: "exact", head: true });

  const weekAgo = daysAgo(7);
  const visits = (event: "view" | "play") =>
    staffP.then((st) => (st.role === "admin" ? supabase.from("visit_events").select("*", { count: "exact", head: true }).eq("event", event).gte("created_at", weekAgo) : null));
  const [phasesLive, recLive, drafts, inactive, archived, users, hidden, logs, audio, sourceRow, views, plays] = await Promise.all([
    head("phases").eq("publication_status", "published").eq("is_active", true),
    head("recitations").eq("publication_status", "published").eq("is_active", true),
    head("recitations").eq("publication_status", "draft"),
    head("recitations").eq("is_active", false),
    head("recitations").eq("publication_status", "archived"),
    staffP.then((st) => (st.role === "admin" ? head("profiles").eq("is_active", true) : null)),
    supabase
      .from("recitations")
      .select("slug, title, audio_source, phases!inner(title, publication_status, is_active), youtube_id, audio_files(id, synthetic)")
      .eq("publication_status", "published")
      .eq("is_active", true),
    supabase.from("audit_logs").select("id, entity_type, action, summary, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("audio_files").select("file_size_bytes"),
    supabase.from("app_settings").select("value").eq("key", "audio_source").maybeSingle(),
    visits("view"),
    visits("play"),
  ]);
  const source = parseAudioSource(sourceRow.data?.value);
  const staff = await staffP;
  const hasSource = (r: { audio_source: string | null; youtube_id: string | null; audio_files: unknown }) => {
    const chosen = resolveAudioSource(r.audio_source, source);
    const kinds = (Array.isArray(r.audio_files) ? r.audio_files : r.audio_files ? [r.audio_files] : []) as { synthetic: boolean }[];
    if (chosen === "mp3") return kinds.some((k) => !k.synthetic);
    if (chosen === "tts") return kinds.some((k) => k.synthetic);
    if (chosen === "youtube") return !!r.youtube_id;
    return true;
  };
  const withoutAudio = (hidden.data ?? []).filter((r) => !hasSource(r as never)).length;
  const audioBytes = (audio.data ?? []).reduce((sum, f) => sum + Number(f.file_size_bytes), 0);

  const notShown = (hidden.data ?? []).filter((r) => {
    const p = r.phases as unknown as { publication_status: string; is_active: boolean };
    return p.publication_status !== "published" || !p.is_active;
  });

  return (
    <>
      <h1>Dashboard</h1>
      <Flash searchParams={props.searchParams} />

      <div className="stats">
        {views !== null && <Stat label="Kunjungan 7 hari" value={views.count ?? 0} href="/putrazea/traffic" />}
        {plays !== null && <Stat label="Audio diputar 7 hari" value={plays.count ?? 0} href="/putrazea/traffic" />}
        <Stat label="Fase tampil" value={phasesLive.count ?? 0} href="/putrazea/phases" />
        <Stat label="Bacaan tampil" value={recLive.count ?? 0} href="/putrazea/recitations" />
        <Stat label="Draft menunggu terbit" value={drafts.count ?? 0} href="/putrazea/recitations" />
        <Stat label="Bacaan nonaktif" value={inactive.count ?? 0} href="/putrazea/recitations" />
        <Stat label="Bacaan diarsipkan" value={archived.count ?? 0} href="/putrazea/recitations" />
        {users !== null && <Stat label="Pengguna aktif" value={users.count ?? 0} href="/putrazea/users" />}
        <Stat label="Terbit tanpa audio sesuai pilihannya" value={withoutAudio} href="/putrazea/recitations" />
        <Stat label={`File audio (${(audioBytes / 1024 / 1024).toFixed(1)} MB)`} value={audio.data?.length ?? 0} href={staff.role === "admin" ? "/putrazea/settings" : "/putrazea/recitations"} />
      </div>

      {notShown.length > 0 && (
        <p className="msg warn" role="status">
          {notShown.length} bacaan berstatus terbit tapi fasenya belum terbit atau nonaktif, jadi belum tampil di publik:{" "}
          {notShown.map((r) => r.title).join(", ")}.
        </p>
      )}

      <h2>Aktivitas terakhir</h2>
      {logs.data?.length ? (
        <ul className="activity">
          {logs.data.map((l) => {
            const s = (l.summary ?? {}) as { actor?: string; title?: string; slug?: string };
            return (
              <li key={l.id}>
                <time dateTime={l.created_at}>{new Date(l.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</time>{" "}
                <strong>{s.actor ?? "?"}</strong> {l.action} {l.entity_type} {s.title ?? s.slug ?? ""}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">Belum ada aktivitas.</p>
      )}
      <p>
        <Link prefetch={false} href="/putrazea/history">Lihat semua riwayat</Link>
      </p>
    </>
  );
}

// ponytail: module-level so the per-request clock read is not flagged as an impure render
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link prefetch={false} href={href} className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </Link>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
