import Link from "next/link";
import { notFound } from "next/navigation";
import { savePhase } from "@/actions/content";
import { ActionForm } from "@/components/admin/action-form";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PhaseFormPage(props: PageProps<"/putrazea/phases/[id]">) {
  const staffP = requireStaff();
  const { id } = await props.params;
  const isNew = id === "new";

  let phase: { id: string; slug: string; title: string; description: string | null; is_active: boolean; continue_numbering: boolean; publication_status: string } | null = null;
  if (!isNew) {
    const supabase = await createClient();
    const { data } = await supabase.from("phases").select("id, slug, title, description, is_active, continue_numbering, publication_status").eq("id", id).maybeSingle();
    if (!data) notFound();
    phase = data;
  }

  const staff = await staffP;
  const published = phase?.publication_status === "published";
  const locked = published && staff.role !== "admin";

  return (
    <>
      <p>
        <Link prefetch={false} href="/putrazea/phases">← Fase</Link>
      </p>
      <h1>{isNew ? "Fase baru" : "Edit fase"}</h1>
      {locked && (
        <p className="msg warn">Fase ini sudah terbit. Hanya admin yang boleh mengubah isinya. Editor masih bisa mengatur urutan dan aktif/nonaktif dari daftar.</p>
      )}
      {!locked && (
        <ActionForm action={savePhase} submitLabel="Simpan">
          {phase && <input type="hidden" name="id" value={phase.id} />}
          <label>
            Slug
            <input name="slug" defaultValue={phase?.slug} required pattern="[a-z0-9][a-z0-9\-]*" placeholder="fase1" />
            <small>Pengenal tetap untuk tautan #bagian. Huruf kecil, angka, tanda hubung.</small>
          </label>
          <label>
            Judul
            <input name="title" defaultValue={phase?.title} required />
          </label>
          <label>
            Deskripsi
            <textarea name="description" rows={2} defaultValue={phase?.description ?? ""} />
          </label>
          <label className="check">
            <input name="is_active" type="checkbox" defaultChecked={phase?.is_active ?? true} /> Aktif
          </label>
          <label className="check">
            <input name="continue_numbering" type="checkbox" defaultChecked={phase?.continue_numbering ?? false} /> Lanjutkan nomor bacaan dari fase sebelumnya
          </label>
          {published && (
            <label className="check warn">
              <input name="confirm" type="checkbox" /> Saya mengerti fase ini sudah terbit dan perubahan langsung tampil di publik.
            </label>
          )}
        </ActionForm>
      )}
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
