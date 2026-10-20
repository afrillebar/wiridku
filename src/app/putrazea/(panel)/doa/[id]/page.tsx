import Link from "next/link";
import { notFound } from "next/navigation";
import { savePrayer } from "@/actions/doa";
import { ActionForm } from "@/components/admin/action-form";
import { Flash } from "@/components/admin/flash";
import { requireStaff } from "@/lib/auth";
import { PRAYER_CATEGORIES } from "@/lib/doa";
import { createClient } from "@/lib/supabase/server";

export default async function PrayerFormPage(props: PageProps<"/putrazea/doa/[id]">) {
  const { id } = await props.params;
  const { c: presetCategory } = await props.searchParams;
  const isNew = id === "new";
  const supabase = await createClient();
  const [staff, { data: p }] = await Promise.all([requireStaff(), isNew ? { data: null } : supabase.from("daily_prayers").select("*").eq("id", id).maybeSingle()]);
  if (!isNew && !p) notFound();

  const published = p?.publication_status === "published";
  const locked = published && staff.role !== "admin";

  return (
    <>
      <p>
        <Link prefetch={false} href="/putrazea/doa">
          ← Doa Harian
        </Link>
      </p>
      <h1>{isNew ? "Doa baru" : "Edit doa"}</h1>
      <Flash searchParams={props.searchParams as Promise<{ ok?: string; error?: string }>} />
      {locked && <p className="msg warn">Doa ini sudah terbit. Hanya admin yang boleh mengubah isinya. Editor masih bisa mengaktifkan atau menonaktifkannya dari daftar.</p>}
      {!locked && (
        <ActionForm action={savePrayer} submitLabel="Simpan">
          {p && <input type="hidden" name="id" value={p.id} />}
          <div className="row">
            <label>
              Kelompok
              <select name="category" defaultValue={p?.category ?? (typeof presetCategory === "string" ? presetCategory : "")} required>
                <option value="" disabled>
                  Pilih kelompok…
                </option>
                {PRAYER_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Urutan di kelompok
              <input name="sort_order" type="number" min={1} step={1} defaultValue={p?.sort_order ?? ""} placeholder="(otomatis di akhir)" />
            </label>
          </div>
          <div className="row">
            <label>
              Judul
              <input name="title" defaultValue={p?.title} required placeholder="Doa Masuk Rumah" />
            </label>
            <label>
              Slug
              <input name="slug" defaultValue={p?.slug} required pattern="[a-z0-9][a-z0-9\-]*" placeholder="masuk-rumah" />
              <small>Pengenal di alamat (/doa-harian#slug). Jangan diubah setelah terbit.</small>
            </label>
          </div>
          <label>
            Teks Arab
            <textarea name="arabic_text" dir="rtl" lang="ar" rows={5} className="arabic-input" defaultValue={p?.arabic_text ?? ""} required />
            <small>Tempel apa adanya dari sumber (Hisnul Muslim atau mushaf). Tidak ada koreksi otomatis. Satu doa yang terdiri dari beberapa kalimat terpisah ditulis satu baris per bagian, dan latin serta artinya mengikuti jumlah baris yang sama.</small>
          </label>
          <label>
            Latin (transliterasi)
            <textarea name="transliteration" rows={4} defaultValue={p?.transliteration ?? ""} />
          </label>
          <label>
            Arti
            <textarea name="translation" rows={4} defaultValue={p?.translation ?? ""} />
          </label>
          <div className="row">
            <label>
              Sumber / dalil
              <input name="reference_text" defaultValue={p?.reference_text ?? ""} placeholder="HR. Bukhari dan Muslim" />
            </label>
            <label>
              Label ulang
              <input name="repeat_label" defaultValue={p?.repeat_label ?? ""} placeholder="3×" />
            </label>
          </div>
          <label>
            Keterangan kapan dibaca
            <input name="note" defaultValue={p?.note ?? ""} placeholder="Dibaca ketika bangun dari tidur." />
          </label>
          <label>
            Catatan editor
            <textarea name="editor_note" rows={2} defaultValue={p?.editor_note ?? ""} />
            <small>Hanya terlihat di admin.</small>
          </label>
          <label className="check">
            <input name="is_active" type="checkbox" defaultChecked={p?.is_active ?? true} /> Aktif
          </label>
          {published && (
            <label className="check warn">
              <input name="confirm" type="checkbox" /> Saya mengerti doa ini sudah terbit dan perubahan langsung tampil di publik.
            </label>
          )}
        </ActionForm>
      )}
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = "force-disabled";
