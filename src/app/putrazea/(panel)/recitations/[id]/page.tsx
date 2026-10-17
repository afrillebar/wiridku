import Link from "next/link";
import { notFound } from "next/navigation";
import { saveRecitation } from "@/actions/content";
import { ActionForm } from "@/components/admin/action-form";
import { AudioManager, type CurrentAudio } from "@/components/admin/audio-manager";
import { Flash } from "@/components/admin/flash";
import { SourceBadges } from "@/components/admin/lists";
import { AUDIO_SOURCE_LABEL, parseAudioSource, resolveAudioSource, type AudioSource } from "@/lib/audio-source";
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
  const [staff, { data: phases }, { data: r }, { data: audioRows }, maxMb, { data: sourceRow }] = await Promise.all([
    requireStaff(),
    supabase.from("phases").select("id, title").order("sort_order"),
    isNew ? { data: null } : supabase.from("recitations").select("*").eq("id", id).maybeSingle(),
    isNew ? { data: null } : supabase.from("audio_files").select("*").eq("recitation_id", id),
    isNew ? 0 : getAudioMaxMb(supabase),
    supabase.from("app_settings").select("value").eq("key", "audio_source").maybeSingle(),
  ]);
  const source = parseAudioSource(sourceRow?.value);
  if (!isNew && !r) notFound();

  const published = r?.publication_status === "published";
  const locked = published && staff.role !== "admin";

  const withUrl = async (row: NonNullable<typeof audioRows>[number] | undefined): Promise<CurrentAudio | null> => {
    if (!row) return null;
    const { data: signed } = await supabase.storage.from("audio").createSignedUrl(row.storage_path, 60 * 60);
    return { ...row, version: row.audio_version, url: signed?.signedUrl ?? null };
  };
  const cues = audioRows?.find((a) => !a.synthetic)?.cues;
  const cueCount = Array.isArray(cues) ? cues.length : 0;
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
            Sumber audio bacaan ini
            <select name="audio_source" defaultValue={r?.audio_source ?? "default"}>
              <option value="default">Ikut semua ({AUDIO_SOURCE_LABEL[source]})</option>
              {(Object.keys(AUDIO_SOURCE_LABEL) as AudioSource[]).map((m) => (
                <option key={m} value={m}>
                  {AUDIO_SOURCE_LABEL[m]}
                </option>
              ))}
            </select>
            <small>MP3, TTS, atau YouTube untuk kartu ini saja. “Ikut semua” memakai pilihan di Pengaturan.</small>
          </label>
          <label>
            Tautan YouTube (opsional)
            <input name="youtube_url" type="text" inputMode="url" defaultValue={r?.youtube_id ? `https://youtu.be/${r.youtube_id}` : ""} placeholder="https://www.youtube.com/watch?v=..." />
            <small>Di kartu muncul tombol Dengarkan dari YouTube yang membuka pemutar resmi YouTube (videonya terlihat; aturan YouTube melarang menyembunyikan video atau memisahkan suaranya). Pakai video yang boleh disematkan dan yang pemiliknya memberi izin.</small>
          </label>
          <div className="row">
            <label>
              Mulai di detik
              <input name="youtube_start" type="number" min={0} step={1} defaultValue={r?.youtube_start ?? ""} placeholder="0" />
            </label>
            <label>
              Selesai di detik
              <input name="youtube_end" type="number" min={1} step={1} defaultValue={r?.youtube_end ?? ""} placeholder="(sampai habis)" />
            </label>
          </div>
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
            <SourceBadges audio={{ recording: recording ? (recording.reciter_name ?? "") : null, synthetic: !!synthetic, youtube: !!r.youtube_id }} source={resolveAudioSource(r.audio_source, source)} />
          </p>
          <ul>
            <li>
              <strong>MP3 rekaman:</strong>{" "}
              {recording ? `${recording.reciter_name ?? "tanpa nama qari"} · ${Math.round(Number(recording.duration_seconds ?? 0))} dtk${cueCount ? ` · ${cueCount} penanda hitungan` : ""}` : "belum ada"}
            </li>
            <li>
              <strong>MP3 sintetis (TTS):</strong> {synthetic ? `ada · ${Math.round(Number(synthetic.duration_seconds ?? 0))} dtk` : "belum ada"}
            </li>
            <li>
              <strong>YouTube:</strong> {r.youtube_id ? <a href={`https://youtu.be/${r.youtube_id}`} target="_blank" rel="noreferrer">youtu.be/{r.youtube_id}</a> : "belum ada"}
            </li>
          </ul>
          <p className="muted">
            Pengunjung mendengar: <strong>{AUDIO_SOURCE_LABEL[resolveAudioSource(r.audio_source, source)]}</strong>
            {r.audio_source ? " (pilihan bacaan ini)." : " (ikut pilihan untuk semua)."} File rekaman diganti di bagian Rekaman MP3.
          </p>
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
