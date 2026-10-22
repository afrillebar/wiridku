import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { RecitationGroups, type PhaseInfo, type RecitationRow, type Status } from "@/components/admin/lists";
import { requireStaff } from "@/lib/auth";
import { wiridAudio } from "@/lib/wirid-audio";
import { createClient } from "@/lib/supabase/server";

const audioKinds = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []) as { synthetic: boolean; reciter_name: string | null }[];

export default async function RecitationsPage(props: PageProps<"/putrazea/recitations">) {
  const supabase = await createClient();
  const [staff, { data: phases }] = await Promise.all([
    requireStaff(),
    supabase
      .from("phases")
      .select("id, title, is_active, publication_status, continue_numbering, recitations(id, slug, kind, show_number, title, arabic_text, is_active, publication_status, sort_order, audio_files(synthetic, reciter_name))")
      .order("sort_order")
      .order("sort_order", { referencedTable: "recitations" }),
  ]);

  const info: PhaseInfo[] = (phases ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.publication_status as Status,
    active: p.is_active,
    continue_numbering: p.continue_numbering,
  }));
  const rows: RecitationRow[] = (phases ?? []).flatMap((p) =>
    p.recitations.map((r) => ({
      id: r.id,
      group: p.id,
      sort_order: r.sort_order,
      status: r.publication_status as Status,
      active: r.is_active,
      slug: r.slug,
      title: r.title,
      kind: r.kind as "standard" | "tasbih",
      show_number: r.show_number,
      audio: {
        online: r.slug in wiridAudio,
        recording: audioKinds(r.audio_files).find((x) => !x.synthetic)?.reciter_name ?? (audioKinds(r.audio_files).some((x) => !x.synthetic) ? "" : null),
        synthetic: audioKinds(r.audio_files).some((x) => x.synthetic),
      },
      arabic_empty: !r.arabic_text?.trim(),
    })),
  );

  return (
    <>
      <div className="page-head">
        <h1>Bacaan</h1>
        <Link prefetch={false} href="/putrazea/recitations/new" className="btn primary">
          Bacaan baru
        </Link>
      </div>
      <Flash searchParams={props.searchParams} />
      <p className="muted">
        Tanda ● adalah suara yang dipakai kartu itu: sumber online lebih dulu, rekaman MP3 atau TTS hanya kalau kartu tidak punya sumber online.
      </p>
      <RecitationGroups phases={info} initial={rows} isAdmin={staff.role === "admin"} />
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
