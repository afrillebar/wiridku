"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { goto, text, textOrNull, type FormState } from "@/lib/form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PUBLISHED_ONLY_ADMIN = "Audio bacaan yang sudah terbit hanya bisa diubah admin.";

function parseMeta(fd: FormData): { error: string } | Record<string, string | boolean | null> {
  const sourceUrl = textOrNull(fd, "source_url");
  if (sourceUrl && !/^https?:\/\/\S+$/.test(sourceUrl)) return { error: "URL sumber harus diawali http:// atau https://." };
  return {
    reciter_name: textOrNull(fd, "reciter_name"),
    source_name: textOrNull(fd, "source_name"),
    source_url: sourceUrl,
    license_note: textOrNull(fd, "license_note"),
    offline_available: fd.get("offline_available") === "on",
  };
}

// "1" = the synthetic (TTS) slot, anything else = the recording slot
const kindOf = (fd: FormData) => text(fd, "synthetic") === "1";

// Called by the admin page after the browser uploaded the file to Storage.
// The file must already exist; on error the caller deletes the uploaded object.
export async function saveAudio(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const rid = text(fd, "recitation_id");
  const path = text(fd, "storage_path");
  if (!UUID_RE.test(rid)) return { error: "Bacaan tidak valid." };
  const fileName = path.slice(rid.length + 1);
  if (!path.startsWith(`${rid}/`) || !/^[0-9a-f-]{36}\.mp3$/.test(fileName)) return { error: "Lokasi file tidak valid." };

  const meta = parseMeta(fd);
  if ("error" in meta) return { error: String(meta.error) };
  const synthetic = kindOf(fd);
  const durationRaw = Number(text(fd, "duration"));
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 && durationRaw < 6 * 3600 ? durationRaw : null;

  const supabase = await createClient();
  // ponytail: size and type come from Storage, not from the browser, so they cannot be spoofed
  const { data: listed } = await supabase.storage.from("audio").list(rid, { search: fileName });
  const obj = listed?.find((o) => o.name === fileName);
  if (!obj) return { error: "File belum ada di storage. Unggah ulang." };
  const size = Number(obj.metadata?.size ?? 0);
  const mime = String(obj.metadata?.mimetype ?? "");
  if (mime !== "audio/mpeg" || size <= 0) return { error: "File harus MP3 (audio/mpeg) dan tidak kosong." };

  const { data: prev } = await supabase.from("audio_files").select("id, storage_path, audio_version").eq("recitation_id", rid).eq("synthetic", synthetic).maybeSingle();
  const values = {
    storage_path: path,
    original_filename: text(fd, "original_filename").slice(0, 200) || null,
    mime_type: mime,
    file_size_bytes: size,
    duration_seconds: duration,
    synthetic,
    ...meta,
  };

  if (prev) {
    const { data, error } = await supabase
      .from("audio_files")
      .update({ ...values, audio_version: prev.audio_version + 1 })
      .eq("id", prev.id)
      .select("id");
    if (error && error.code !== "42501") return { error: error.message };
    if (error || !data?.length) return { error: PUBLISHED_ONLY_ADMIN };
  } else {
    const { error } = await supabase.from("audio_files").insert({ recitation_id: rid, ...values });
    if (error) return { error: error.code === "42501" ? PUBLISHED_ONLY_ADMIN : error.message };
  }

  // old file goes only after the new reference is saved, so a failure never leaves the card without audio
  let oldRemoved: boolean | null = null;
  if (prev && prev.storage_path !== path) {
    const { error } = await supabase.storage.from("audio").remove([prev.storage_path]);
    oldRemoved = !error;
  }

  await audit(supabase, staff, "audio", rid, prev ? "replace" : "upload", {
    file: values.original_filename,
    size,
    version: prev ? prev.audio_version + 1 : 1,
    ...(oldRemoved === false ? { old_file_left: prev?.storage_path } : {}),
  });
  updateTag("content");
  return { ok: prev ? "Audio diganti." : "Audio diunggah." };
}

export async function updateAudioMeta(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const rid = text(fd, "recitation_id");
  if (!UUID_RE.test(rid)) return { error: "Bacaan tidak valid." };
  const meta = parseMeta(fd);
  if ("error" in meta) return { error: String(meta.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("audio_files").update(meta).eq("recitation_id", rid).eq("synthetic", kindOf(fd)).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: PUBLISHED_ONLY_ADMIN };

  await audit(supabase, staff, "audio", rid, "update-info", { offline: meta.offline_available });
  updateTag("content");
  return { ok: "Info audio disimpan." };
}

export async function removeAudio(fd: FormData) {
  const staff = await requireAdmin();
  const rid = text(fd, "recitation_id");
  const back = `/putrazea/recitations/${rid}`;
  if (!UUID_RE.test(rid)) redirect("/putrazea/recitations");

  const supabase = await createClient();
  const { data: row } = await supabase.from("audio_files").select("id, storage_path, original_filename").eq("recitation_id", rid).eq("synthetic", kindOf(fd)).maybeSingle();
  if (!row) redirect(goto(back, { error: "Audio tidak ditemukan." }));

  const { error } = await supabase.from("audio_files").delete().eq("id", row.id);
  if (error) redirect(goto(back, { error: error.message }));
  const { error: rmError } = await supabase.storage.from("audio").remove([row.storage_path]);

  await audit(supabase, staff, "audio", rid, "delete", { file: row.original_filename, ...(rmError ? { old_file_left: row.storage_path } : {}) });
  updateTag("content");
  redirect(goto(back, { ok: "Audio dihapus." }));
}
