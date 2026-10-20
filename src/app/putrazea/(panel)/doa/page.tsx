import Link from "next/link";
import { removePrayer, setPrayerActive, setPrayerStatus } from "@/actions/doa";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { DataTable } from "@/components/admin/data-table";
import { Flash } from "@/components/admin/flash";
import { requireStaff } from "@/lib/auth";
import { PRAYER_CATEGORIES, categoryLabel } from "@/lib/doa";
import { createClient } from "@/lib/supabase/server";

const STATUS = { draft: "Draft", published: "Terbit", archived: "Arsip" } as const;

export default async function PrayersPage(props: PageProps<"/putrazea/doa">) {
  const params = await props.searchParams;
  const cat = typeof params.c === "string" ? params.c : "";
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const supabase = await createClient();
  const [staff, { data }] = await Promise.all([requireStaff(), supabase.from("daily_prayers").select("id, slug, category, title, publication_status, is_active, sort_order, reference_text").order("sort_order")]);
  const isAdmin = staff.role === "admin";

  const all = data ?? [];
  const rank = (c: string) => PRAYER_CATEGORIES.findIndex((x) => x.id === c);
  const rows = all
    .filter((p) => (!cat || p.category === cat) && (!q || `${p.title} ${p.slug}`.toLowerCase().includes(q)))
    .sort((a, b) => rank(a.category) - rank(b.category) || a.sort_order - b.sort_order);
  const here = `/putrazea/doa${cat || q ? `?${new URLSearchParams({ ...(cat && { c: cat }), ...(q && { q }) })}` : ""}`;

  return (
    <>
      <div className="page-head">
        <h1>Doa Harian</h1>
        <Link prefetch={false} href="/putrazea/doa/new" className="btn primary">
          Doa baru
        </Link>
      </div>
      <Flash searchParams={props.searchParams as Promise<{ ok?: string; error?: string }>} />
      <p className="muted">
        {all.filter((p) => p.publication_status === "published" && p.is_active).length} doa tampil di situs, dari {all.length}. Halaman publik: <Link href="/doa-harian" target="_blank">/doa-harian</Link>.
      </p>

      <form className="inline" action="/putrazea/doa" method="get">
        <select name="c" defaultValue={cat} aria-label="Kelompok">
          <option value="">Semua kelompok</option>
          {PRAYER_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({all.filter((p) => p.category === c.id).length})
            </option>
          ))}
        </select>
        <input name="q" defaultValue={q} placeholder="Cari judul atau slug" aria-label="Cari" />
        <button type="submit" className="btn small">
          Tampilkan
        </button>
        {(cat || q) && (
          <Link prefetch={false} href="/putrazea/doa" className="btn small">
            Reset
          </Link>
        )}
      </form>

      <DataTable
        colSpan={5}
        empty="Tidak ada doa yang cocok."
        head={
          <tr>
            <th>Judul</th>
            <th>Kelompok</th>
            <th>Status</th>
            <th>Tampil</th>
            <th>Aksi</th>
          </tr>
        }
        rows={rows.map((p) => (
          <tr key={p.id}>
            <td className="wide" data-label="Judul">
              <Link prefetch={false} href={`/putrazea/doa/${p.id}`}>
                {p.title}
              </Link>
              <br />
              <small className="muted">
                {p.slug} · urutan {p.sort_order}
                {p.reference_text ? ` · ${p.reference_text}` : ""}
              </small>
            </td>
            <td data-label="Kelompok">{categoryLabel(p.category)}</td>
            <td data-label="Status">
              <span className={`badge ${p.publication_status}`}>{STATUS[p.publication_status as keyof typeof STATUS]}</span>
            </td>
            <td data-label="Tampil">{p.is_active ? "Aktif" : "Nonaktif"}</td>
            <td className="wide">
              <div className="row-actions">
                <Link prefetch={false} href={`/putrazea/doa/${p.id}`} className="btn small">
                  Edit
                </Link>
                <form action={setPrayerActive}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="active" value={String(!p.is_active)} />
                  <input type="hidden" name="back" value={here} />
                  <ConfirmButton className="btn small" message={p.is_active ? "Sembunyikan doa ini dari situs?" : "Tampilkan doa ini di situs (jika sudah terbit)?"}>
                    {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </ConfirmButton>
                </form>
                {isAdmin && (
                  <>
                    {p.publication_status !== "published" && (
                      <form action={setPrayerStatus}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="to" value="published" />
                        <input type="hidden" name="back" value={here} />
                        <ConfirmButton className="btn small primary" message="Terbitkan doa ini? Langsung tampil di publik.">
                          Terbitkan
                        </ConfirmButton>
                      </form>
                    )}
                    {p.publication_status === "published" && (
                      <form action={setPrayerStatus}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="to" value="draft" />
                        <input type="hidden" name="back" value={here} />
                        <ConfirmButton className="btn small" message="Tarik ke draft? Doa hilang dari situs.">
                          Tarik ke draft
                        </ConfirmButton>
                      </form>
                    )}
                    {p.publication_status !== "archived" && (
                      <form action={setPrayerStatus}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="to" value="archived" />
                        <input type="hidden" name="back" value={here} />
                        <ConfirmButton className="btn small" message="Arsipkan doa ini? Doa hilang dari situs.">
                          Arsipkan
                        </ConfirmButton>
                      </form>
                    )}
                    <form action={removePrayer}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="back" value={here} />
                      <ConfirmButton className="btn small danger" message={`Hapus "${p.title}" selamanya?`}>
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
