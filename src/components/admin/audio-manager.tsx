"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeAudio, saveAudio, updateAudioMeta } from "@/actions/audio";
import { createClient } from "@/lib/supabase/browser";
import { ConfirmButton } from "./confirm-button";

export type CurrentAudio = {
  url: string | null;
  version: number;
  original_filename: string | null;
  file_size_bytes: number;
  duration_seconds: number | null;
  reciter_name: string | null;
  source_name: string | null;
  source_url: string | null;
  license_note: string | null;
  offline_available: boolean;
};

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const dur = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "–");

export function AudioManager({
  recitationId,
  current,
  maxMb,
  canEdit,
  isAdmin,
  synthetic,
}: {
  recitationId: string;
  synthetic: boolean;
  current: CurrentAudio | null;
  maxMb: number;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [, startTransition] = useTransition();

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = (f: File | null) => {
    setMsg(null);
    setDuration(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (!f) return;
    if (f.type !== "audio/mpeg" && !/\.mp3$/i.test(f.name)) return setMsg({ error: "Format harus MP3." });
    if (f.size > maxMb * 1024 * 1024) return setMsg({ error: `Ukuran ${mb(f.size)} melebihi batas ${maxMb} MB.` });
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("file");
    fd.set("recitation_id", recitationId);
    fd.set("synthetic", synthetic ? "1" : "0");
    setMsg(null);

    if (!file) {
      setStage("saving");
      const res = await updateAudioMeta(null, fd);
      setStage("idle");
      setMsg(res);
      if (res?.ok) startTransition(() => router.refresh());
      return;
    }

    setStage("uploading");
    const supabase = createClient();
    const path = `${recitationId}/${crypto.randomUUID()}.mp3`;
    const send = () => supabase.storage.from("audio").upload(path, file, { contentType: "audio/mpeg", cacheControl: "31536000", upsert: false });
    let up = await send();
    // ponytail: a dropped connection looks like "Failed to fetch"; the path is unique, so one retry cannot create a duplicate
    if (up.error && /fetch/i.test(up.error.message)) up = await send();
    if (up.error) {
      setStage("idle");
      setMsg({ error: `Unggah gagal: ${up.error.message}` });
      return;
    }

    setStage("saving");
    fd.set("storage_path", path);
    fd.set("original_filename", file.name);
    if (duration) fd.set("duration", String(duration));
    const res = await saveAudio(null, fd);
    if (res?.error) await supabase.storage.from("audio").remove([path]);
    setStage("idle");
    if (res?.ok) {
      pick(null);
      if (fileInput.current) fileInput.current.value = "";
      startTransition(() => router.refresh());
    }
    // ponytail: set after pick(null), which clears the message
    setMsg(res);
  };

  const busy = stage !== "idle";

  return (
    <section className="audio-manager" id={synthetic ? "tts" : "rekaman"} aria-label={synthetic ? "Suara sintetis" : "Rekaman"}>
      <h2>{synthetic ? "Suara sintetis (TTS)" : "Rekaman MP3"}</h2>
      {current ? (
        <div className="audio-current">
          {current.url && <audio controls preload="none" src={current.url} aria-label="Audio saat ini" />}
          <p className="muted">
            {current.original_filename ?? "file"} · {mb(current.file_size_bytes)} · {dur(current.duration_seconds)} · versi {current.version}
            {current.offline_available ? " · ditawarkan offline" : ""}
          </p>
        </div>
      ) : (
        <p className="muted">{synthetic ? "Belum ada file suara sintetis (buat otomatis dengan npm run db:tts, atau unggah sendiri)." : "Belum ada rekaman."} Saat sumber audio situs memakai jenis ini, kartu tampil tanpa tombol putar.</p>
      )}

      {!canEdit && <p className="msg warn">Bacaan ini sudah terbit. Hanya admin yang boleh mengganti audionya.</p>}

      {canEdit && (
        <form className="form" onSubmit={submit}>
          {msg?.error && (
            <p className="msg error" role="alert">
              {msg.error}
            </p>
          )}
          {msg?.ok && (
            <p className="msg ok" role="status">
              {msg.ok}
            </p>
          )}
          <label>
            {current ? "Ganti file MP3" : "File MP3"}
            <input ref={fileInput} name="file" type="file" accept="audio/mpeg,.mp3" onChange={(e) => pick(e.target.files?.[0] ?? null)} disabled={busy} />
            <small>
              Maksimal {maxMb} MB.{" "}
              {synthetic ? "Untuk file suara mesin (TTS); dibuat otomatis dengan npm run db:tts." : "Gunakan rekaman qari yang boleh dipakai dan didistribusikan; file TTS diunggah di bagian Suara sintetis."}
            </small>
          </label>
          {file && preview && (
            <div className="audio-current">
              <audio controls src={preview} onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)} aria-label="Pratinjau file baru" />
              <p className="muted">
                {file.name} · {mb(file.size)} · {dur(duration)}
              </p>
            </div>
          )}
          <div className="row">
            <label>
              Nama qari
              <input name="reciter_name" defaultValue={current?.reciter_name ?? ""} />
            </label>
            <label>
              Sumber rekaman
              <input name="source_name" defaultValue={current?.source_name ?? ""} />
            </label>
          </div>
          <div className="row">
            <label>
              URL sumber
              <input name="source_url" type="url" defaultValue={current?.source_url ?? ""} placeholder="https://" />
            </label>
            <label>
              Lisensi / izin
              <input name="license_note" defaultValue={current?.license_note ?? ""} placeholder="mis. izin tertulis dari qari, CC BY 4.0" />
            </label>
          </div>
          <label className="check">
            <input name="offline_available" type="checkbox" defaultChecked={current?.offline_available ?? false} /> Tawarkan untuk disimpan offline
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={busy || (!file && !current)}>
              {stage === "uploading" ? "Mengunggah…" : stage === "saving" ? "Menyimpan…" : file ? (current ? "Unggah & ganti" : "Unggah & simpan") : "Simpan info audio"}
            </button>
          </div>
        </form>
      )}

      {isAdmin && current && (
        <form action={removeAudio} className="inline">
          <input type="hidden" name="recitation_id" value={recitationId} />
          <input type="hidden" name="synthetic" value={synthetic ? "1" : "0"} />
          <ConfirmButton className="btn small danger" message="Hapus audio ini dari bacaan dan storage?">
            Hapus audio
          </ConfirmButton>
        </form>
      )}
    </section>
  );
}
