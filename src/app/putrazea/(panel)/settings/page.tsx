import { saveAudioSource, saveCardAudioSources, saveSettings, saveSiteTheme } from "@/actions/settings";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { DataTable } from "@/components/admin/data-table";
import { SourceBadges, type AudioKinds } from "@/components/admin/lists";
import { requireAdmin } from "@/lib/auth";
import { AUDIO_SOURCE_LABEL, parseAudioSource, resolveAudioSource, type AudioSource } from "@/lib/audio-source";
import { AUDIO_MAX_MB_LIMIT, getAudioMaxMb } from "@/lib/settings";
import { parseSiteTheme, SITE_THEMES } from "@/lib/site-theme";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [, maxMb, { data: files }, { data: sourceRow }, { data: themeRow }, { data: cards }] = await Promise.all([
    requireAdmin(),
    getAudioMaxMb(supabase),
    supabase.from("audio_files").select("file_size_bytes"),
    supabase.from("app_settings").select("value").eq("key", "audio_source").maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "site_theme").maybeSingle(),
    supabase
      .from("recitations")
      .select("id, title, sort_order, audio_source, youtube_id, audio_files(synthetic, reciter_name, duration_seconds), phases!inner(title, sort_order)")
      .eq("publication_status", "published")
      .eq("is_active", true)
      .eq("phases.publication_status", "published")
      .eq("phases.is_active", true),
  ]);
  const source = parseAudioSource(sourceRow?.value);
  const theme = parseSiteTheme(themeRow?.value);
  const totalBytes = (files ?? []).reduce((sum, f) => sum + Number(f.file_size_bytes), 0);

  type File = { synthetic: boolean; reciter_name: string | null; duration_seconds: number | null };
  const list = (cards ?? [])
    .map((c) => {
      const audio = (Array.isArray(c.audio_files) ? c.audio_files : c.audio_files ? [c.audio_files] : []) as File[];
      const phase = (Array.isArray(c.phases) ? c.phases[0] : c.phases) as { title: string; sort_order: number };
      const rec = audio.find((a) => !a.synthetic);
      return {
        id: c.id,
        title: c.title,
        phase,
        order: phase.sort_order * 1000 + c.sort_order,
        rec,
        choice: (c.audio_source ?? null) as AudioSource | null,
        kinds: { recording: rec ? (rec.reciter_name ?? "") : null, synthetic: audio.some((a) => a.synthetic), youtube: !!c.youtube_id } satisfies AudioKinds,
      };
    })
    .sort((a, b) => a.order - b.order);
  const coverage: Record<Exclude<AudioSource, "off">, number> = {
    mp3: list.filter((c) => c.kinds.recording !== null).length,
    tts: list.filter((c) => c.kinds.synthetic).length,
    youtube: list.filter((c) => c.kinds.youtube).length,
  };
  const total = list.length;

  return (
    <>
      <h1>Pengaturan</h1>

      <h2>Tema tampilan depan</h2>
      <p className="muted">Warna yang dilihat pengunjung di situs. Panel admin tidak ikut berubah; tema panel ada di kanan atas.</p>
      <ActionForm action={saveSiteTheme} submitLabel="Simpan tema">
        <fieldset className="source-choice">
          <legend>Pilihan warna situs</legend>
          {SITE_THEMES.map((item) => (
            <label key={item.id} className="check source-option">
              <input type="radio" name="theme" value={item.id} defaultChecked={theme === item.id} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
                <span className="theme-swatch" aria-hidden="true">
                  {item.swatch.map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </ActionForm>

      <h2>Sumber untuk semua</h2>
      <p className="muted">
        Dipakai oleh bacaan yang diatur “Ikut semua”. Kartu yang tidak punya sumber pilihannya tampil tanpa tombol audio, tanpa cadangan dari sumber lain.
      </p>
      <ActionForm action={saveAudioSource} submitLabel="Simpan pilihan untuk semua">
        <fieldset className="source-choice">
          <legend>Pilihan untuk semua bacaan</legend>
          {(Object.keys(AUDIO_SOURCE_LABEL) as AudioSource[]).map((m) => (
            <label key={m} className="check source-option">
              <input type="radio" name="mode" value={m} defaultChecked={source === m} />
              <span>
                <strong>{AUDIO_SOURCE_LABEL[m]}</strong>
                <small>
                  {m === "mp3" && `Rekaman manusia yang diunggah di form bacaan. Tersedia di ${coverage.mp3} dari ${total} kartu. Bisa disimpan offline.`}
                  {m === "tts" && `File MP3 buatan mesin (Arab lalu arti Indonesia), diberi catatan "bukan rekaman qari". Tersedia di ${coverage.tts} dari ${total} kartu. Bisa disimpan offline.`}
                  {m === "youtube" && `Tombol "Dengarkan dari YouTube" membuka pemutar resmi YouTube (video terlihat, butuh internet). Tersedia di ${coverage.youtube} dari ${total} kartu.`}
                  {m === "off" && "Tidak ada tombol audio, YouTube, atau pemutar apa pun."}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="check">
          <input name="apply_all" type="checkbox" /> Terapkan ke setiap bacaan sekarang (hapus pilihan satu per satu)
        </label>
      </ActionForm>

      <h2>Sumber satu per satu</h2>
      <p className="muted">
        Tiap bacaan bisa memakai MP3 rekaman, TTS, atau YouTube sendiri. “Ikut semua” mengikuti pilihan di atas ({AUDIO_SOURCE_LABEL[source]}). File MP3 diganti dari halaman bacaan.
      </p>
      <ActionForm action={saveCardAudioSources} submitLabel="Simpan pilihan per bacaan" className="form card-sources">
        <DataTable
          keepMounted
          colSpan={4}
          empty="Belum ada bacaan terbit."
          head={
            <tr>
              <th>Bacaan</th>
              <th>Dipakai</th>
              <th>Audio tersedia</th>
              <th>Rekaman</th>
            </tr>
          }
          rows={list.map((c) => (
            <tr key={c.id}>
              <td className="wide">
                <Link prefetch={false} href={`/putrazea/recitations/${c.id}#rekaman`}>
                  <strong>{c.title}</strong>
                </Link>
                <br />
                <small className="muted">{c.phase.title}</small>
              </td>
              <td data-label="Dipakai">
                <select name={`source:${c.id}`} defaultValue={c.choice ?? "default"} aria-label={`Sumber audio ${c.title}`}>
                  <option value="default">Ikut semua</option>
                  {(Object.keys(AUDIO_SOURCE_LABEL) as AudioSource[]).map((m) => (
                    <option key={m} value={m}>
                      {AUDIO_SOURCE_LABEL[m]}
                    </option>
                  ))}
                </select>
              </td>
              <td data-label="Audio">
                <SourceBadges audio={c.kinds} source={resolveAudioSource(c.choice, source)} />
              </td>
              <td data-label="Rekaman">
                {c.rec ? `${c.rec.reciter_name ?? "Tanpa nama"} · ${Math.round(Number(c.rec.duration_seconds ?? 0))} dtk` : <span className="muted">—</span>}
                <br />
                <Link prefetch={false} href={`/putrazea/recitations/${c.id}#rekaman`}>
                  Ganti MP3
                </Link>
              </td>
            </tr>
          ))}
        />
      </ActionForm>

      <h2>Batas unggahan</h2>
      <ActionForm action={saveSettings} submitLabel="Simpan batas">
        <label>
          Batas ukuran file MP3 (MB)
          <input name="audio_max_mb" type="number" min={1} max={AUDIO_MAX_MB_LIMIT} step={1} defaultValue={maxMb} required />
          <small>Diterapkan langsung ke bucket Storage, jadi unggahan yang lebih besar ditolak server. Paket gratis Supabase punya batas per file sendiri; cek halaman harga.</small>
        </label>
      </ActionForm>

      <h2>Pemakaian storage audio</h2>
      <p>
        {files?.length ?? 0} file · {(totalBytes / 1024 / 1024).toFixed(2)} MB
      </p>
      <p className="muted">Dihitung dari metadata file yang tercatat. Angka kuota dan pemakaian resmi ada di dashboard Supabase.</p>
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
