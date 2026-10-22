import Link from "next/link";
import { notFound } from "next/navigation";
import { saveReading } from "@/actions/readings";
import { ActionForm } from "@/components/admin/action-form";
import { Flash } from "@/components/admin/flash";
import { requireStaff } from "@/lib/auth";
import type { DoaClip } from "@/lib/doa";
import { clipsToText, isReadingModule, quranToText, READING_MODULES, type QuranRange, type ReadingBlock } from "@/lib/readings";
import { createClient } from "@/lib/supabase/server";

export default async function ReadingFormPage(props: PageProps<"/putrazea/readings/[module]/[id]">) {
  const { module, id } = await props.params;
  if (!isReadingModule(module)) notFound();
  const isNew = id === "new";
  const supabase = await createClient();
  const [staff, { data: r }] = await Promise.all([requireStaff(), isNew ? { data: null } : supabase.from("readings").select("*").eq("id", id).eq("module", module).maybeSingle()]);
  if (!isNew && !r) notFound();

  const here = `/putrazea/readings/${module}`;
  const published = r?.publication_status === "published";
  const locked = published && staff.role !== "admin";
  const blocks = (r?.blocks ?? []) as ReadingBlock[];
  const join = (key: "ar" | "la" | "ti") => blocks.map((b) => b[key] ?? "").join("\n");

  return (
    <>
      <p>
        <Link prefetch={false} href={here}>
          ← {READING_MODULES[module].label}
        </Link>
      </p>
      <h1>{isNew ? "Bacaan baru" : "Edit bacaan"}</h1>
      <Flash searchParams={props.searchParams as Promise<{ ok?: string; error?: string }>} />
      {locked && <p className="msg warn">Bacaan ini sudah terbit. Hanya admin yang boleh mengubah isinya. Editor masih bisa mengaktifkan atau menonaktifkannya dari daftar.</p>}
      {!locked && (
        <ActionForm action={saveReading} submitLabel="Simpan">
          <input type="hidden" name="module" value={module} />
          {r && <input type="hidden" name="id" value={r.id} />}
          <div className="row">
            <label>
              Jenis
              <select name="kind" defaultValue={r?.kind ?? "text"}>
                <option value="text">Teks sendiri (dzikir, doa, shalawat)</option>
                <option value="quran">Dari Al-Qur&apos;an (teks dan suara dari Quran.com)</option>
              </select>
            </label>
            <label>
              Urutan di menu
              <input name="sort_order" type="number" min={1} step={1} defaultValue={r?.sort_order ?? ""} placeholder="(otomatis di akhir)" />
            </label>
          </div>
          <div className="row">
            <label>
              Judul
              <input name="title" defaultValue={r?.title} required placeholder="Doa Arwah" />
            </label>
            <label>
              Slug
              <input name="slug" defaultValue={r?.slug} required pattern="[a-z0-9][a-z0-9\-]*" placeholder="doa-arwah" />
              <small>Pengenal di alamat ({READING_MODULES[module].path}/slug). Jangan diubah setelah terbit.</small>
            </label>
          </div>
          <div className="row">
            <label>
              Nama Arab
              <input name="arabic_title" dir="rtl" lang="ar" className="arabic-input" defaultValue={r?.arabic_title ?? ""} />
              <small>Tampil di kanan daftar dan judul.</small>
            </label>
            <label>
              Keterangan singkat
              <input name="sub_label" defaultValue={r?.sub_label ?? ""} placeholder="Dzikir" />
            </label>
          </div>

          <fieldset>
            <legend>Jenis “Dari Al-Qur&apos;an”</legend>
            <label>
              Surah dan ayat
              <textarea name="quran" rows={3} className="mono" spellCheck={false} defaultValue={quranToText((r?.quran ?? []) as QuranRange[])} placeholder={"36\n2:255\n2:284-286"} />
              <small>Satu baris satu bagian: 36 (satu surah penuh), 2:255 (satu ayat), 2:284-286 (rentang ayat). Teks, latin, arti, dan suara Alafasy diambil otomatis.</small>
            </label>
          </fieldset>

          <fieldset>
            <legend>Jenis “Teks sendiri”</legend>
            <label>
              Teks Arab
              <textarea name="arabic_text" dir="rtl" lang="ar" rows={6} className="arabic-input" defaultValue={join("ar")} />
              <small>Satu baris Arab satu bagian yang dibaca. Tempel apa adanya dari sumber, tidak ada koreksi otomatis.</small>
            </label>
            <label>
              Latin (transliterasi)
              <textarea name="transliteration" rows={5} defaultValue={join("la")} />
              <small>Jumlah baris sama dengan Arab, atau kosongkan.</small>
            </label>
            <label>
              Arti
              <textarea name="translation" rows={5} defaultValue={join("ti")} />
              <small>Jumlah baris sama dengan Arab, atau kosongkan.</small>
            </label>
            <label>
              Audio (diputar dari internet, tidak disimpan)
              <textarea name="clips" rows={4} className="mono" spellCheck={false} defaultValue={clipsToText((r?.clips ?? []) as DoaClip[])} placeholder="https://… | dari detik | sampai detik" />
              <small>Satu baris satu tautan https, sejumlah baris Arab, atau kosongkan kalau tanpa audio. Detik dari dan sampai boleh dikosongkan (seluruh file). Pakai audio yang boleh disematkan.</small>
            </label>
          </fieldset>

          <label>
            Sumber / dalil
            <input name="reference_text" defaultValue={r?.reference_text ?? ""} placeholder="HR. Bukhari dan Muslim" />
          </label>
          <label>
            Catatan editor
            <textarea name="editor_note" rows={2} defaultValue={r?.editor_note ?? ""} />
            <small>Hanya terlihat di admin.</small>
          </label>
          <label className="check">
            <input name="is_active" type="checkbox" defaultChecked={r?.is_active ?? true} /> Aktif
          </label>
          {published && (
            <label className="check warn">
              <input name="confirm" type="checkbox" /> Saya mengerti bacaan ini sudah terbit dan perubahan langsung tampil di publik.
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
