"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isPrayerCategory } from "@/lib/doa";
import { createClient } from "@/lib/supabase/server";
import { SLUG_RE, goto, text, textOrNull, type FormState } from "@/lib/form";

const BACK = "/putrazea/doa";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function dbMessage(e: PostgrestError): string {
  if (e.code === "23505") return "Slug sudah dipakai. Pilih slug lain.";
  if (e.code === "23514") return "Teks Arab tidak boleh kosong.";
  if (/editor can only (change|create)|editor cannot/.test(e.message)) return "Editor tidak boleh mengubah doa yang sudah diterbitkan. Minta admin menariknya ke draft dulu.";
  return e.message;
}

// ---------- create / edit ----------

export async function savePrayer(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = text(fd, "id");
  const slug = text(fd, "slug");
  const title = text(fd, "title");
  const category = text(fd, "category");
  const arabic = text(fd, "arabic_text");
  const orderRaw = text(fd, "sort_order");

  if (id && !UUID_RE.test(id)) return { error: "Data tidak valid." };
  if (!SLUG_RE.test(slug)) return { error: "Slug hanya huruf kecil, angka, dan tanda hubung (mis. masuk-masjid)." };
  if (!title) return { error: "Judul wajib diisi." };
  if (!isPrayerCategory(category)) return { error: "Pilih kelompok doa." };
  if (!arabic) return { error: "Teks Arab wajib diisi." };
  const order = orderRaw === "" ? null : Number(orderRaw);
  if (order !== null && (!Number.isInteger(order) || order < 1 || order > 10000)) return { error: "Urutan harus bilangan bulat 1 atau lebih." };

  const supabase = await createClient();
  const values = {
    slug,
    category,
    title,
    arabic_text: arabic,
    transliteration: textOrNull(fd, "transliteration"),
    translation: textOrNull(fd, "translation"),
    reference_text: textOrNull(fd, "reference_text"),
    note: textOrNull(fd, "note"),
    repeat_label: textOrNull(fd, "repeat_label"),
    editor_note: textOrNull(fd, "editor_note"),
    is_active: fd.get("is_active") === "on",
  };

  let savedId = id;
  if (id) {
    const { data: cur } = await supabase.from("daily_prayers").select("publication_status").eq("id", id).maybeSingle();
    if (!cur) return { error: "Doa tidak ditemukan." };
    if (cur.publication_status === "published") {
      if (staff.role !== "admin") return { error: "Doa sudah diterbitkan. Minta admin menariknya ke draft dulu." };
      if (fd.get("confirm") !== "on") return { error: "Doa ini sudah diterbitkan. Centang konfirmasi karena perubahan langsung tampil di publik." };
    }
    const { data, error } = await supabase
      .from("daily_prayers")
      .update(order === null ? values : { ...values, sort_order: order })
      .eq("id", id)
      .select("id");
    if (error) return { error: dbMessage(error) };
    if (!data?.length) return { error: "Tidak ada yang berubah (tidak punya izin?)." };
  } else {
    let sort = order;
    if (sort === null) {
      const { data: last } = await supabase.from("daily_prayers").select("sort_order").eq("category", category).order("sort_order", { ascending: false }).limit(1);
      sort = (last?.[0]?.sort_order ?? 0) + 1;
    }
    const { data, error } = await supabase
      .from("daily_prayers")
      .insert({ ...values, publication_status: "draft", sort_order: sort })
      .select("id")
      .single();
    if (error) return { error: dbMessage(error) };
    savedId = data.id;
  }

  await audit(supabase, staff, "prayer", savedId, id ? "update" : "create", { slug, title });
  updateTag("content");
  redirect(goto(BACK, { ok: id ? "Doa disimpan." : "Doa dibuat sebagai draft." }));
}

// ---------- row actions (plain forms in the list) ----------

function readId(fd: FormData) {
  const id = text(fd, "id");
  if (!UUID_RE.test(id)) redirect(goto(BACK, { error: "Data tidak valid." }));
  return id;
}
const back = (fd: FormData) => {
  const to = text(fd, "back");
  return to.startsWith(BACK) ? to : BACK;
};

export async function setPrayerStatus(fd: FormData) {
  const id = readId(fd);
  const to = text(fd, "to");
  if (to !== "draft" && to !== "published" && to !== "archived") redirect(goto(BACK, { error: "Status tidak valid." }));
  const staff = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("daily_prayers").update({ publication_status: to }).eq("id", id).select("slug");
  if (error) redirect(goto(back(fd), { error: dbMessage(error) }));
  if (!data?.length) redirect(goto(back(fd), { error: "Tidak punya izin atau doa tidak ditemukan." }));
  await audit(supabase, staff, "prayer", id, { published: "publish", archived: "archive", draft: "unpublish" }[to], { slug: data[0].slug, to });
  updateTag("content");
  redirect(goto(back(fd), { ok: { published: "Doa diterbitkan.", archived: "Doa diarsipkan.", draft: "Doa dikembalikan ke draft." }[to] }));
}

export async function setPrayerActive(fd: FormData) {
  const id = readId(fd);
  const active = text(fd, "active") === "true";
  const staff = await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("daily_prayers").update({ is_active: active }).eq("id", id).select("slug");
  if (error) redirect(goto(back(fd), { error: dbMessage(error) }));
  if (!data?.length) redirect(goto(back(fd), { error: "Tidak punya izin atau doa tidak ditemukan." }));
  await audit(supabase, staff, "prayer", id, active ? "activate" : "deactivate", { slug: data[0].slug });
  updateTag("content");
  redirect(goto(back(fd), { ok: active ? "Doa diaktifkan." : "Doa dinonaktifkan." }));
}

export async function removePrayer(fd: FormData) {
  const id = readId(fd);
  const staff = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("daily_prayers").delete().eq("id", id).select("slug, title");
  if (error) redirect(goto(back(fd), { error: dbMessage(error) }));
  if (!data?.length) redirect(goto(back(fd), { error: "Tidak ada yang terhapus." }));
  await audit(supabase, staff, "prayer", id, "delete", { slug: data[0].slug, title: data[0].title });
  updateTag("content");
  redirect(goto(back(fd), { ok: "Doa dihapus." }));
}
