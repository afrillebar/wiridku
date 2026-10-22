import Link from "next/link";
import { notFound } from "next/navigation";
import { removeReading, setReadingActive, setReadingStatus } from "@/actions/readings";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { DataTable } from "@/components/admin/data-table";
import { Flash } from "@/components/admin/flash";
import { requireStaff } from "@/lib/auth";
import { isReadingModule, READING_MODULES } from "@/lib/readings";
import { createClient } from "@/lib/supabase/server";

const STATUS = { draft: "Draft", published: "Terbit", archived: "Arsip" } as const;

export default async function ReadingsPage(props: PageProps<"/putrazea/readings/[module]">) {
  const { module } = await props.params;
  if (!isReadingModule(module)) notFound();
  const { label, path } = READING_MODULES[module];
  const supabase = await createClient();
  const [staff, { data }] = await Promise.all([requireStaff(), supabase.from("readings").select("id, slug, title, kind, publication_status, is_active, sort_order, reference_text").eq("module", module).order("sort_order")]);
  const isAdmin = staff.role === "admin";
  const rows = data ?? [];
  const here = `/putrazea/readings/${module}`;

  return (
    <>
      <div className="page-head">
        <h1>{label}</h1>
        <Link prefetch={false} href={`${here}/new`} className="btn primary">
          Bacaan baru
        </Link>
      </div>
      <Flash searchParams={props.searchParams} />
      <p className="muted">
        {rows.filter((r) => r.publication_status === "published" && r.is_active).length} bacaan tampil di situs, dari {rows.length}. Halaman publik:{" "}
        <Link href={path} target="_blank">
          {path}
        </Link>
        .
      </p>

      <DataTable
        colSpan={4}
        empty="Belum ada bacaan."
        head={
          <tr>
            <th>Judul</th>
            <th>Status</th>
            <th>Tampil</th>
            <th>Aksi</th>
          </tr>
        }
        rows={rows.map((r) => (
          <tr key={r.id}>
            <td className="wide" data-label="Judul">
              <Link prefetch={false} href={`${here}/${r.id}`}>
                {r.title}
              </Link>
              <br />
              <small className="muted">
                {r.slug} · urutan {r.sort_order} · {r.kind === "quran" ? "dari Al-Qur'an" : "teks sendiri"}
                {r.reference_text ? ` · ${r.reference_text}` : ""}
              </small>
            </td>
            <td data-label="Status">
              <span className={`badge ${r.publication_status}`}>{STATUS[r.publication_status as keyof typeof STATUS]}</span>
            </td>
            <td data-label="Tampil">{r.is_active ? "Aktif" : "Nonaktif"}</td>
            <td className="wide">
              <div className="row-actions">
                <Link prefetch={false} href={`${here}/${r.id}`} className="btn small">
                  Edit
                </Link>
                <form action={setReadingActive}>
                  <input type="hidden" name="module" value={module} />
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="active" value={String(!r.is_active)} />
                  <input type="hidden" name="back" value={here} />
                  <ConfirmButton className="btn small" message={r.is_active ? "Sembunyikan bacaan ini dari situs?" : "Tampilkan bacaan ini di situs (jika sudah terbit)?"}>
                    {r.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </ConfirmButton>
                </form>
                {isAdmin && (
                  <>
                    {r.publication_status !== "published" && (
                      <form action={setReadingStatus}>
                        <input type="hidden" name="module" value={module} />
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="to" value="published" />
                        <input type="hidden" name="back" value={here} />
                        <ConfirmButton className="btn small primary" message="Terbitkan bacaan ini? Langsung tampil di publik.">
                          Terbitkan
                        </ConfirmButton>
                      </form>
                    )}
                    {r.publication_status === "published" && (
                      <form action={setReadingStatus}>
                        <input type="hidden" name="module" value={module} />
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="to" value="draft" />
                        <input type="hidden" name="back" value={here} />
                        <ConfirmButton className="btn small" message="Tarik ke draft? Bacaan hilang dari situs.">
                          Tarik ke draft
                        </ConfirmButton>
                      </form>
                    )}
                    {r.publication_status !== "archived" && (
                      <form action={setReadingStatus}>
                        <input type="hidden" name="module" value={module} />
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="to" value="archived" />
                        <input type="hidden" name="back" value={here} />
                        <ConfirmButton className="btn small" message="Arsipkan bacaan ini? Bacaan hilang dari situs.">
                          Arsipkan
                        </ConfirmButton>
                      </form>
                    )}
                    <form action={removeReading}>
                      <input type="hidden" name="module" value={module} />
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="back" value={here} />
                      <ConfirmButton className="btn small danger" message={`Hapus "${r.title}" selamanya?`}>
                        Hapus
                      </ConfirmButton>
                    </form>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      />
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = "force-disabled";
