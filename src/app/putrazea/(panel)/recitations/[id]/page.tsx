import Link from "next/link";
import { notFound } from "next/navigation";
import { saveRecitation } from "@/actions/content";
import { ActionForm } from "@/components/admin/action-form";
import { AudioManager, type CurrentAudio } from "@/components/admin/audio-manager";
import { Flash } from "@/components/admin/flash";
import { SourceBadges } from "@/components/admin/lists";
import { wiridAudio } from "@/lib/wirid-audio";
import { getAudioMaxMb } from "@/lib/settings";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const TASBIH_EXAMPLE = `[
  { "arabic": "...", "transliteration": "...", "target": 33 }
]`;

export default async function RecitationFormPage(props: PageProps<"/putrazea/recitations/[id]">) {
  const { id } = await props.params;
  const { phase: presetPhase } = await props.searchParams;
  const isNew = id === "new";
  const supabase = await createClient();

  // ponytail: independent queries run together; the session check no longer waits in front of them
  const [staff, { data: phases }, { data: r }, { data: audioRows }, maxMb] = await Promise.all([
    requireStaff(),
    supabase.from("phases").select("id, title").order("sort_order"),
    isNew ? { data: null } : supabase.from("recitations").select("*").eq("id", id).maybeSingle(),
    isNew ? { data: null } : supabase.from("audio_files").select("*").eq("recitation_id", id),
    isNew ? 0 : getAudioMaxMb(supabase),
  ]);
  if (!isNew && !r) notFound();

  const published = r?.publication_status === "published";
  const locked = published && staff.role !== "admin";

  const withUrl = async (row: NonNullable<typeof audioRows>[number] | undefined): Promise<CurrentAudio | null> => {
    if (!row) return null;
    const { data: signed } = await supabase.storage.from("audio").createSignedUrl(row.storage_path, 60 * 60);
    return { ...row, version: row.audio_version, url: signed?.signedUrl ?? null };
  };
  const [recording, synthetic] = await Promise.all([withUrl(audioRows?.find((a) => !a.synthetic)), withUrl(audioRows?.find((a) => a.synthetic))]);

  return (
    <>
      <p>
        <Link prefetch={false} href="/putrazea/recitations">← Bacaan</Link>
      </p>
      <h1>{isNew ? "Bacaan baru" : "Edit bacaan"}</h1>
      <Flash searchParams={props.searchParams as Promise<{ ok?: string; error?: string }>} />
      {locked && (
        <p className="msg warn">Bacaan ini sudah terbit. Hanya admin yang boleh mengubah isinya. Editor masih bisa mengatur urutan dan aktif/nonaktif dari daftar.</p>
      )}
      {!locked && (
        <ActionForm action={saveRecitation} submitLabel="Simpan">
          {r && <input type="hidden" name="id" value={r.id} />}
          <label>
            Fase
            <select name="phase_id" defaultValue={r?.phase_id ?? (typeof presetPhase === "string" ? presetPhase : "")} required>
              <option value="" disabled>
                Pilih fase…
              </option>
              {phases?.map((p, i) => (
                <option key={p.id} value={p.id}>
                  Fase {i + 1}: {p.title}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <label>
              Slug
              <input name="slug" defaultValue={r?.slug} required pattern="[a-z0-9][a-z0-9\-]*" placeholder="f1-1" />
              <small>Pengenal tetap. Progres pengguna disimpan dengan slug ini, jangan diubah setelah terbit.</small>
            </label>
            <label>
              Jenis
              <select name="kind" defaultValue={r?.kind ?? "standard"}>
                <option value="standard">Biasa</option>
                <option value="tasbih">Tasbih (dengan penghitung)</option>
              </select>
            </label>
          </div>
          <div className="row">
            <label>
              Judul
              <input name="title" defaultValue={r?.title} required />
            </label>
            <label className="check number-check">
              <input name="show_number" type="checkbox" defaultChecked={r?.show_number ?? true} /> Tampilkan nomor urut
              <small>Nomor dihitung otomatis dari bacaan yang tampil.</small>
            </label>
          </div>
          <label>
            Teks Arab
            <textarea name="arabic_text" dir="rtl" lang="ar" rows={5} className="arabic-input" defaultValue={r?.arabic_text ?? ""} />
            <small>Tempel apa adanya dari sumber. Tidak ada koreksi otomatis. Wajib terisi untuk jenis Biasa sebelum diterbitkan.</small>
          </label>
          <label>
            Transliterasi
            <textarea name="transliteration" rows={3} defaultValue={r?.transliteration ?? ""} />
          </label>
          <label>
            Arti
            <textarea name="translation" rows={3} defaultValue={r?.translation ?? ""} />
          </label>
          <div className="row">
            <label>
              Label jumlah ulang / rujukan singkat
              <input name="chip_label" defaultValue={r?.chip_label ?? ""} placeholder="3×" />
            </label>
            <label>
              Sumber
              <input name="reference_text" defaultValue={r?.reference_text ?? ""} placeholder="HR. Muslim no. 591" />
            </label>
          </div>
          <label>
            Konfigurasi tasbih (JSON)
            <textarea
              name="tasbih_json"
              rows={7}
              className="mono"
              spellCheck={false}
              placeholder={TASBIH_EXAMPLE}
              defaultValue={r?.tasbih_config ? JSON.stringify(r.tasbih_config.steps, null, 2) : ""}
            />
            <small>Hanya dipakai untuk jenis Tasbih: daftar langkah berisi arabic, transliteration, target.</small>
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
      {r && (
        <section className="audio-summary">
          <h2>Audio bacaan ini</h2>
          <p>
            <SourceBadges audio={{ online: r.slug in wiridAudio, recording: recording ? (recording.reciter_name ?? "") : null, synthetic: !!synthetic }} />
          </p>
          <ul>
            <li>
              <strong>Sumber online:</strong> {r.slug in wiridAudio ? "ada, diputar langsung dari internet (tidak disimpan di sini)" : "tidak ada"}
            </li>
            <li>
              <strong>MP3 rekaman:</strong>{" "}
              {recording ? `${recording.reciter_name ?? "tanpa nama qari"} · ${Math.round(Number(recording.duration_seconds ?? 0))} dtk` : "belum ada"}
            </li>
            <li>
              <strong>MP3 sintetis (TTS):</strong> {synthetic ? `ada · ${Math.round(Number(synthetic.duration_seconds ?? 0))} dtk` : "belum ada"}
            </li>
          </ul>
          <p className="muted">Pengunjung mendengar sumber online lebih dulu. Rekaman MP3 atau TTS di bawah hanya diputar kalau bacaan ini tidak punya sumber online.</p>
        </section>
      )}
      {r &&
        ([false, true] as const).map((kind) => (
          <AudioManager
            key={String(kind)}
            recitationId={r.id}
            synthetic={kind}
            current={kind ? synthetic : recording}
            maxMb={maxMb}
            canEdit={staff.role === "admin" || r.publication_status === "draft"}
            isAdmin={staff.role === "admin"}
          />
        ))}
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
