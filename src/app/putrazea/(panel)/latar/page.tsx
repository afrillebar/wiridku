import Link from "next/link";
import { removeBackground, setBackgroundActive } from "@/actions/backgrounds";
import { BackgroundUploader } from "@/components/admin/background-uploader";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Flash } from "@/components/admin/flash";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function BackgroundsPage(props: PageProps<"/putrazea/latar">) {
  const supabase = await createClient();
  const [staff, { data, error }] = await Promise.all([
    requireStaff(),
    supabase.from("listen_backgrounds").select("id, title, storage_path, credit, is_active, created_at").order("created_at"),
  ]);
  const isAdmin = staff.role === "admin";
  const rows = data ?? [];
  const url = (path: string) => supabase.storage.from("backgrounds").getPublicUrl(path).data.publicUrl;

  return (
    <>
      <div className="page-head">
        <h1>Latar Al-Qur&apos;an</h1>
      </div>
      <Flash searchParams={props.searchParams as Promise<{ ok?: string; error?: string }>} />
      {error ? (
        <p className="msg error" role="alert">
          Tabel latar belum ada. Jalankan migrasi listen_backgrounds di Supabase dulu. ({error.message})
        </p>
      ) : (
        <p className="muted">
          Gambar latar untuk mode dengar di halaman surah. {rows.filter((b) => b.is_active).length} tampil di situs, dari {rows.length}. Latar pertama yang aktif menjadi bawaan. Contoh:{" "}
          <Link href="/alquran/1" target="_blank">
            /alquran/1
          </Link>
          .
        </p>
      )}

      {rows.length > 0 && (
        <ul className="bg-grid">
          {rows.map((b) => (
            <li key={b.id} className={b.is_active ? undefined : "off"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url(b.storage_path)} alt="" loading="lazy" />
              <div>
                <strong>{b.title}</strong>
                <small className="muted">
                  {b.is_active ? "Tampil" : "Disembunyikan"}
                  {b.credit ? ` · ${b.credit}` : ""}
                </small>
                <div className="row-actions">
                  <form action={setBackgroundActive}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="active" value={String(!b.is_active)} />
                    <ConfirmButton className="btn small" message={b.is_active ? "Sembunyikan latar ini dari situs?" : "Tampilkan latar ini di situs?"}>
                      {b.is_active ? "Sembunyikan" : "Tampilkan"}
                    </ConfirmButton>
                  </form>
                  {isAdmin && (
                    <form action={removeBackground}>
                      <input type="hidden" name="id" value={b.id} />
                      <ConfirmButton className="btn small danger" message={`Hapus latar "${b.title}" beserta filenya?`}>
                        Hapus
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!error && <BackgroundUploader />}
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = "force-disabled";
