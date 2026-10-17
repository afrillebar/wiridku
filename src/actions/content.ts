"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath, updateTag } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { SLUG_RE, goto, text, textOrNull, type FormState } from "@/lib/form";
import { isAudioSource } from "@/lib/audio-source";
import { parseYoutubeId } from "@/lib/youtube";

type Entity = "phase" | "recitation";
const TABLE = { phase: "phases", recitation: "recitations" } as const;

function dbMessage(e: PostgrestError): string {
  if (e.code === "23505") return "Slug sudah dipakai. Pilih slug lain.";
  if (e.code === "23514") return "Teks Arab kosong, tidak bisa dipublikasi.";
  if (e.code === "23503") return "Data ini masih dipakai data lain (mis. fase yang masih punya bacaan).";
  if (/editor can only (change|create)|editor cannot/.test(e.message))
    return "Editor tidak boleh mengubah isi bacaan yang sudah dipublikasi. Minta admin menarik ke draft dulu.";
  return e.message;
}


// ---------- save (create / edit) ----------

export async function savePhase(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = text(fd, "id");
  const slug = text(fd, "slug");
  const title = text(fd, "title");

  if (!SLUG_RE.test(slug)) return { error: "Slug hanya huruf kecil, angka, dan tanda hubung (mis. fase1)." };
  if (!title) return { error: "Judul wajib diisi." };

  const supabase = await createClient();
  const values = {
    slug,
    title,
    description: textOrNull(fd, "description"),
    is_active: fd.get("is_active") === "on",
    continue_numbering: fd.get("continue_numbering") === "on",
  };

  let savedId = id;
  if (id) {
    const { data: cur } = await supabase.from("phases").select("publication_status").eq("id", id).maybeSingle();
    if (!cur) return { error: "Fase tidak ditemukan." };
    if (cur.publication_status === "published") {
      if (staff.role !== "admin") return { error: "Fase sudah dipublikasi. Minta admin menarik ke draft dulu." };
      if (fd.get("confirm") !== "on") return { error: "Fase ini sudah dipublikasi. Centang konfirmasi karena perubahan langsung tampil di publik." };
    }
    const { data, error } = await supabase.from("phases").update(values).eq("id", id).select("id");
    if (error) return { error: dbMessage(error) };
    if (!data?.length) return { error: "Tidak ada yang berubah (tidak punya izin?)." };
  } else {
    const { data: last } = await supabase.from("phases").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const { data, error } = await supabase
      .from("phases")
      .insert({ ...values, publication_status: "draft", sort_order: (last?.[0]?.sort_order ?? 0) + 1 })
      .select("id")
      .single();
    if (error) return { error: dbMessage(error) };
    savedId = data.id;
  }

  await audit(supabase, staff, "phase", savedId, id ? "update" : "create", { slug, title });
  updateTag("content");
  redirect(goto("/putrazea/phases", { ok: id ? "Fase disimpan." : "Fase dibuat sebagai draft." }));
}

function parseTasbih(raw: string): { steps: { arabic: string; transliteration: string; target: number }[] } | string {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return "Konfigurasi tasbih bukan JSON yang valid.";
  }
  if (!Array.isArray(json) || json.length === 0) return "Konfigurasi tasbih harus berupa daftar langkah (array) yang tidak kosong.";
  const steps = [];
  for (const s of json as Record<string, unknown>[]) {
    const target = Number(s?.target);
    if (typeof s?.arabic !== "string" || !s.arabic.trim()) return "Setiap langkah tasbih butuh teks Arab (arabic).";
    if (!Number.isInteger(target) || target < 1) return "Target tasbih harus bilangan bulat positif.";
    steps.push({ arabic: s.arabic.trim(), transliteration: String(s.transliteration ?? "").trim(), target });
  }
  return { steps };
}

export async function saveRecitation(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = text(fd, "id");
  const slug = text(fd, "slug");
  const title = text(fd, "title");
  const phaseId = text(fd, "phase_id");
  const kind = text(fd, "kind") === "tasbih" ? "tasbih" : "standard";

  if (!phaseId) return { error: "Fase wajib dipilih." };
  if (!SLUG_RE.test(slug)) return { error: "Slug hanya huruf kecil, angka, dan tanda hubung (mis. f1-1)." };
  if (!title) return { error: "Judul wajib diisi." };

  const ytRaw = text(fd, "youtube_url");
  const youtubeId = ytRaw ? parseYoutubeId(ytRaw) : null;
  if (ytRaw && !youtubeId) return { error: "Tautan YouTube tidak dikenali. Tempel alamat video (youtube.com/watch?v=..., youtu.be/..., atau /embed/...)." };
  const secs = (key: string) => {
    const raw = text(fd, key);
    return raw === "" ? null : Number(raw);
  };
  const ytStart = secs("youtube_start");
  const ytEnd = secs("youtube_end");
  for (const v of [ytStart, ytEnd]) if (v !== null && (!Number.isInteger(v) || v < 0)) return { error: "Detik mulai/selesai YouTube harus bilangan bulat, 0 atau lebih." };
  if (ytEnd !== null && ytEnd <= (ytStart ?? 0)) return { error: "Detik selesai YouTube harus lebih besar dari detik mulai." };

  let tasbihConfig = null;
  if (kind === "tasbih") {
    const parsed = parseTasbih(text(fd, "tasbih_json"));
    if (typeof parsed === "string") return { error: parsed };
    tasbihConfig = parsed;
  }

  const pickedSource = text(fd, "audio_source");
  if (pickedSource !== "default" && !isAudioSource(pickedSource)) return { error: "Sumber audio tidak valid." };

  const supabase = await createClient();
  const values = {
    phase_id: phaseId,
    audio_source: pickedSource === "default" ? null : pickedSource,
    slug,
    kind,
    show_number: fd.get("show_number") === "on",
    youtube_id: youtubeId,
    youtube_start: youtubeId ? ytStart : null,
    youtube_end: youtubeId ? ytEnd : null,
    title,
    arabic_text: textOrNull(fd, "arabic_text"),
    transliteration: textOrNull(fd, "transliteration"),
    translation: textOrNull(fd, "translation"),
    chip_label: textOrNull(fd, "chip_label"),
    reference_text: textOrNull(fd, "reference_text"),
    editor_note: textOrNull(fd, "editor_note"),
    tasbih_config: tasbihConfig,
    is_active: fd.get("is_active") === "on",
  };

  let savedId = id;
  if (id) {
    const { data: cur } = await supabase.from("recitations").select("publication_status").eq("id", id).maybeSingle();
    if (!cur) return { error: "Bacaan tidak ditemukan." };
    if (cur.publication_status === "published") {
      if (staff.role !== "admin") return { error: "Bacaan sudah dipublikasi. Minta admin menarik ke draft dulu." };
      if (fd.get("confirm") !== "on") return { error: "Bacaan ini sudah dipublikasi. Centang konfirmasi karena perubahan langsung tampil di publik." };
    }
    const { data, error } = await supabase.from("recitations").update(values).eq("id", id).select("id");
    if (error) return { error: dbMessage(error) };
    if (!data?.length) return { error: "Tidak ada yang berubah (tidak punya izin?)." };
  } else {
    const { data: last } = await supabase
      .from("recitations")
      .select("sort_order")
      .eq("phase_id", phaseId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const { data, error } = await supabase
      .from("recitations")
      .insert({ ...values, publication_status: "draft", sort_order: (last?.[0]?.sort_order ?? 0) + 1 })
      .select("id")
      .single();
    if (error) return { error: dbMessage(error) };
    savedId = data.id;
  }

  await audit(supabase, staff, "recitation", savedId, id ? "update" : "create", { slug, title });
  updateTag("content");
  redirect(goto("/putrazea/recitations", { ok: id ? "Bacaan disimpan." : "Bacaan dibuat sebagai draft." }));
}

// ---------- row actions (called from the optimistic lists) ----------

export type RowResult = { ok?: string; error?: string };
const LIST_PATH = { phase: "/putrazea/phases", recitation: "/putrazea/recitations" } as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const badId = (id: string) => !UUID_RE.test(id);

// ponytail: each action is one database round trip next to the session check; the audit row is written after the response is sent
function finish(entity: Entity) {
  updateTag("content");
  revalidatePath(LIST_PATH[entity]);
}

export async function toggleActive(entity: Entity, id: string, active: boolean): Promise<RowResult> {
  if (badId(id)) return { error: "Data tidak valid." };
  const supabase = await createClient();
  const [staff, res] = await Promise.all([
    requireStaff(),
    supabase.from(TABLE[entity]).update({ is_active: active }).eq("id", id).select("slug"),
  ]);
  if (res.error) return { error: dbMessage(res.error) };
  if (!res.data?.length) return { error: "Tidak punya izin atau data tidak ditemukan." };

  after(() => audit(supabase, staff, entity, id, active ? "activate" : "deactivate", { slug: res.data[0].slug }));
  finish(entity);
  return { ok: active ? "Diaktifkan." : "Dinonaktifkan." };
}

// The client already worked out the new order; every id in it only gets a new sort_order, so a bad payload cannot do more than reorder.
export async function moveRows(entity: Entity, changes: { id: string; sort_order: number }[]): Promise<RowResult> {
  if (!changes.length || changes.length > 200 || changes.some((c) => badId(c.id) || !Number.isInteger(c.sort_order) || c.sort_order < 1 || c.sort_order > 100000))
    return { error: "Urutan tidak valid." };
  const supabase = await createClient();
  const [staff, results] = await Promise.all([
    requireStaff(),
    Promise.all(changes.map((c) => supabase.from(TABLE[entity]).update({ sort_order: c.sort_order }).eq("id", c.id).select("id"))),
  ]);
  const failed = results.find((r) => r.error || !r.data?.length);
  if (failed) return { error: failed.error ? dbMessage(failed.error) : "Tidak punya izin mengubah urutan." };

  after(() => audit(supabase, staff, entity, changes[0].id, "reorder", { rows: changes.length }));
  finish(entity);
  return { ok: "Urutan disimpan." };
}

export async function setStatus(entity: Entity, id: string, to: "draft" | "published" | "archived"): Promise<RowResult> {
  if (badId(id) || !["draft", "published", "archived"].includes(to)) return { error: "Data tidak valid." };
  const supabase = await createClient();
  const [staff, res] = await Promise.all([
    requireAdmin(),
    supabase.from(TABLE[entity]).update({ publication_status: to }).eq("id", id).select("slug, publication_status"),
  ]);
  if (res.error) return { error: dbMessage(res.error) };
  if (!res.data?.length) return { error: "Tidak punya izin atau data tidak ditemukan." };

  const action = { published: "publish", archived: "archive", draft: "unpublish" }[to];
  after(() => audit(supabase, staff, entity, id, action, { slug: res.data[0].slug, to }));
  finish(entity);
  return { ok: { published: "Dipublikasi.", archived: "Diarsipkan.", draft: "Dikembalikan ke draft." }[to] };
}

export async function remove(entity: Entity, id: string): Promise<RowResult> {
  if (badId(id)) return { error: "Data tidak valid." };
  const supabase = await createClient();
  const [staff, res] = await Promise.all([requireAdmin(), supabase.from(TABLE[entity]).delete().eq("id", id).select("slug, title")]);
  if (res.error) return { error: dbMessage(res.error) };
  if (!res.data?.length) return { error: "Tidak ada yang terhapus." };

  after(async () => {
    await audit(supabase, staff, entity, id, "delete", { slug: res.data[0].slug, title: res.data[0].title });
    // the audio_files row went with the cascade, but its MP3 is still in Storage
    if (entity === "recitation") {
      const { data: files } = await supabase.storage.from("audio").list(id);
      if (files?.length) await supabase.storage.from("audio").remove(files.map((f) => `${id}/${f.name}`));
    }
  });
  finish(entity);
  return { ok: "Dihapus." };
}
