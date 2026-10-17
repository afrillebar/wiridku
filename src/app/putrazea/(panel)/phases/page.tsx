import Link from "next/link";
import { Flash } from "@/components/admin/flash";
import { PhaseTable, type PhaseRow, type Status } from "@/components/admin/lists";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PhasesPage(props: PageProps<"/putrazea/phases">) {
  const supabase = await createClient();
  const [staff, { data: phases }] = await Promise.all([
    requireStaff(),
    supabase.from("phases").select("id, slug, title, sort_order, is_active, publication_status, recitations(count)").order("sort_order"),
  ]);

  const rows: PhaseRow[] = (phases ?? []).map((p) => ({
    id: p.id,
    group: "",
    sort_order: p.sort_order,
    status: p.publication_status as Status,
    active: p.is_active,
    slug: p.slug,
    title: p.title,
    count: (p.recitations as unknown as { count: number }[])[0]?.count ?? 0,
  }));

  return (
    <>
      <div className="page-head">
        <h1>Fase</h1>
        <Link prefetch={false} href="/putrazea/phases/new" className="btn primary">
          Fase baru
        </Link>
      </div>
      <Flash searchParams={props.searchParams} />
      <PhaseTable initial={rows} isAdmin={staff.role === "admin"} />
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
