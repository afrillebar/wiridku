"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { goto, text, textOrNull, type FormState } from "@/lib/form";

const BACK = "/putrazea/latar";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PATH_RE = /^[0-9a-f-]{36}\.(webp|jpg|png)$/;
const MIME = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" } as const;

// Called by the admin page after the browser uploaded the image to Storage.
// On error the caller deletes the uploaded object.
export async function saveBackground(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const path = text(fd, "storage_path");
  const title = text(fd, "title");
  const credit = textOrNull(fd, "credit");
  const ext = PATH_RE.exec(path)?.[1] as keyof typeof MIME | undefined;
  if (!ext) return { error: "Lokasi file tidak valid." };
  if (!title || title.length > 80) return { error: "Judul wajib diisi, paling panjang 80 huruf." };
  if (credit && credit.length > 200) return { error: "Kredit paling panjang 200 huruf." };

  const supabase = await createClient();
  // size and type come from Storage, not from the browser, so they cannot be spoofed
  const { data: listed } = await supabase.storage.from("backgrounds").list("", { search: path });
  const obj = listed?.find((o) => o.name === path);
  if (!obj) return { error: "File belum ada di storage. Unggah ulang." };
  const size = Number(obj.metadata?.size ?? 0);
  if (obj.metadata?.mimetype !== MIME[ext] || size <= 0) return { error: "File harus gambar WebP, JPEG, atau PNG dan tidak kosong." };

  const { data, error } = await supabase.from("listen_backgrounds").insert({ title, storage_path: path, credit }).select("id").single();
  if (error) return { error: error.message };

  await audit(supabase, staff, "background", data.id, "upload", { title, size });
  updateTag("content");
  return { ok: "Latar ditambahkan." };
}

function readId(fd: FormData) {
  const id = text(fd, "id");
  if (!UUID_RE.test(id)) redirect(goto(BACK, { error: "Data tidak valid." }));
  return id;
}

export async function setBackgroundActive(fd: FormData) {
  const id = readId(fd);
  const active = text(fd, "active") === "true";
  const staff = await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("listen_backgrounds").update({ is_active: active }).eq("id", id).select("title");
  if (error) redirect(goto(BACK, { error: error.message }));
  if (!data?.length) redirect(goto(BACK, { error: "Tidak punya izin atau latar tidak ditemukan." }));
  await audit(supabase, staff, "background", id, active ? "activate" : "deactivate", { title: data[0].title });
  updateTag("content");
  redirect(goto(BACK, { ok: active ? "Latar ditampilkan." : "Latar disembunyikan." }));
}

export async function removeBackground(fd: FormData) {
  const id = readId(fd);
  const staff = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("listen_backgrounds").delete().eq("id", id).select("title, storage_path");
  if (error) redirect(goto(BACK, { error: error.message }));
  if (!data?.length) redirect(goto(BACK, { error: "Tidak ada yang terhapus." }));
  // the row goes first, so a failed file removal never leaves the site pointing at a missing image
  const { error: rmError } = await supabase.storage.from("backgrounds").remove([data[0].storage_path]);
  await audit(supabase, staff, "background", id, "delete", { title: data[0].title, ...(rmError ? { old_file_left: data[0].storage_path } : {}) });
  updateTag("content");
  redirect(goto(BACK, { ok: "Latar dihapus." }));
}
