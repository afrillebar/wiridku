"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBackground } from "@/actions/backgrounds";
import { createClient } from "@/lib/supabase/browser";
import { uuid } from "@/lib/uuid";

const MAX_EDGE = 1920;
const MAX_MB = 5;
const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

// Shrinks to at most 1920 px on the long side as WebP (JPEG where the browser cannot encode WebP).
// The listening view blurs and darkens the image, so this keeps full quality at a fraction of the size.
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const encode = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.82));
  const webp = await encode("image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("Browser tidak bisa mengubah gambar ini.");
  return jpeg;
}

const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export function BackgroundUploader() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [stage, setStage] = useState<"idle" | "preparing" | "uploading" | "saving">("idle");
  const [, startTransition] = useTransition();

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = async (f: File | null) => {
    setMsg(null);
    setBlob(null);
    setPreview(null);
    if (!f) return;
    if (!EXT[f.type]) return setMsg({ error: "Format harus JPEG, PNG, atau WebP." });
    setStage("preparing");
    try {
      const out = await shrink(f);
      if (out.size > MAX_MB * 1024 * 1024) throw new Error(`Hasilnya ${kb(out.size)}, melebihi ${MAX_MB} MB.`);
      setBlob(out);
      setPreview(URL.createObjectURL(out));
    } catch (e) {
      setMsg({ error: e instanceof Error ? e.message : "Gambar tidak bisa dibaca." });
    }
    setStage("idle");
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!blob) return;
    const fd = new FormData(e.currentTarget);
    fd.delete("file");
    setMsg(null);
    setStage("uploading");
    const supabase = createClient();
    const path = `${uuid()}.${EXT[blob.type]}`;
    const send = () => supabase.storage.from("backgrounds").upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
    let up = await send();
    // a dropped connection looks like "Failed to fetch"; the path is unique, so one retry cannot create a duplicate
    if (up.error && /fetch/i.test(up.error.message)) up = await send();
    if (up.error) {
      setStage("idle");
      setMsg({ error: `Unggah gagal: ${up.error.message}` });
      return;
    }

    setStage("saving");
    fd.set("storage_path", path);
    const res = await saveBackground(null, fd);
    if (res?.error) await supabase.storage.from("backgrounds").remove([path]);
    setStage("idle");
    if (res?.ok) {
      form.current?.reset();
      setBlob(null);
      setPreview(null);
      startTransition(() => router.refresh());
    }
    setMsg(res);
  };

  const busy = stage !== "idle";

  return (
    <form ref={form} className="form" onSubmit={submit}>
      <h2>Tambah latar</h2>
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
        Gambar
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files?.[0] ?? null)} disabled={busy} />
        <small>JPEG, PNG, atau WebP. Diperkecil otomatis di browser ke maksimal {MAX_EDGE} px. Pilih foto tenang tanpa teks; di situs gambar diburamkan dan digelapkan.</small>
      </label>
      {preview && blob && (
        <div className="bg-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Pratinjau latar" />
          <p className="muted">Siap diunggah · {kb(blob.size)}</p>
        </div>
      )}
      <div className="row">
        <label>
          Judul
          <input name="title" required maxLength={80} placeholder="mis. Langit senja" />
        </label>
        <label>
          Kredit foto
          <input name="credit" maxLength={200} placeholder="mis. Foto: Nama, Unsplash" />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={busy || !blob}>
          {stage === "preparing" ? "Menyiapkan…" : stage === "uploading" ? "Mengunggah…" : stage === "saving" ? "Menyimpan…" : "Unggah & simpan"}
        </button>
      </div>
    </form>
  );
}
