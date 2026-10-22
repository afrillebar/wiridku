"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { SLUG_RE, goto, text, textOrNull, type FormState } from "@/lib/form";
import { getVerses } from "@/lib/quran";
import { isReadingModule, parseBlocks, parseClips, parseQuran, type ReadingModuleName } from "@/lib/readings";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const base = (m: ReadingModuleName) => `/putrazea/readings/${m}`;

function dbMessage(e: PostgrestError): string {
  if (e.code === "23505") return "Slug sudah dipakai di menu ini. Pilih slug lain.";
  if (/editor can only (change|create)|editor cannot/.test(e.message)) return "Editor tidak boleh mengubah bacaan yang sudah diterbitkan. Minta admin menariknya ke draft dulu.";
  return e.message;
}

function moduleOf(fd: FormData) {
  const m = text(fd, "module");
  if (!isReadingModule(m)) redirect("/putrazea");
  return m;
}

// ---------- create / edit ----------

export async function saveReading(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const mod = moduleOf(fd);
  const id = text(fd, "id");
  const slug = text(fd, "slug");
  const title = text(fd, "title");
  const kind = text(fd, "kind") === "quran" ? "quran" : "text";
  const orderRaw = text(fd, "sort_order");

  if (id && !UUID_RE.test(id)) return { error: "Data tidak valid." };
  if (!SLUG_RE.test(slug)) return { error: "Slug hanya huruf kecil, angka, dan tanda hubung (mis. doa-arwah)." };
  if (!title) return { error: "Judul wajib diisi." };
  const order = orderRaw === "" ? null : Number(orderRaw);
  if (order !== null && (!Number.isInteger(order) || order < 1 || order > 10000)) return { error: "Urutan harus bilangan bulat 1 atau lebih." };

  let blocks: unknown[] = [];
  let quran: unknown[] = [];
  let clips: unknown[] = [];
  if (kind === "quran") {
    const parsed = parseQuran(text(fd, "quran"));
    if (typeof parsed === "string") return { error: parsed };
    if (!parsed.length) return { error: "Isi surah atau ayat yang dibaca." };
    // a range past the end of the surah cannot be cut out of its recitation, so it is checked here
    for (const r of parsed) {
      const verses = await getVerses(r.surah).catch(() => null);
      if (!verses) return { error: "Tidak bisa memeriksa jumlah ayat sekarang (Quran.com tidak terjangkau). Coba lagi." };
      if (r.to !== undefined && r.to > verses.length) return { error: `Surah ${r.surah} hanya punya ${verses.length} ayat.` };
    }
    quran = parsed;
  } else {
    const parsed = parseBlocks(text(fd, "arabic_text"), text(fd, "transliteration"), text(fd, "translation"));
    if (typeof parsed === "string") return { error: parsed };
    const parsedClips = parseClips(text(fd, "clips"));
    if (typeof parsedClips === "string") return { error: parsedClips };
    // each clip is one line; any other number could not be followed line by line
    if (parsedClips.length && parsedClips.length !== parsed.length) return { error: `Audio harus ${parsed.length} baris (satu per baris Arab), atau dikosongkan. Sekarang ${parsedClips.length}.` };
    blocks = parsed;
    clips = parsedClips;
  }

  const supabase = await createClient();
  const values = {
    module: mod,
    slug,
    title,
    kind,
    arabic_title: textOrNull(fd, "arabic_title"),
    sub_label: textOrNull(fd, "sub_label"),
    reference_text: textOrNull(fd, "reference_text"),
    editor_note: textOrNull(fd, "editor_note"),
    blocks,
    quran,
    clips,
    is_active: fd.get("is_active") === "on",
  };

  let savedId = id;
  if (id) {
    const { data: cur } = await supabase.from("readings").select("publication_status").eq("id", id).maybeSingle();
    if (!cur) return { error: "Bacaan tidak ditemukan." };
    if (cur.publication_status === "published") {
      if (staff.role !== "admin") return { error: "Bacaan sudah diterbitkan. Minta admin menariknya ke draft dulu." };
      if (fd.get("confirm") !== "on") return { error: "Bacaan ini sudah diterbitkan. Centang konfirmasi karena perubahan langsung tampil di publik." };
    }
    const { data, error } = await supabase.from("readings").update(order === null ? values : { ...values, sort_order: order }).eq("id", id).select("id");
    if (error) return { error: dbMessage(error) };
    if (!data?.length) return { error: "Tidak ada yang berubah (tidak punya izin?)." };
  } else {
    let sort = order;
    if (sort === null) {
      const { data: last } = await supabase.from("readings").select("sort_order").eq("module", mod).order("sort_order", { ascending: false }).limit(1);
      sort = (last?.[0]?.sort_order ?? 0) + 1;
    }
    const { data, error } = await supabase.from("readings").insert({ ...values, publication_status: "draft", sort_order: sort }).select("id").single();
    if (error) return { error: dbMessage(error) };
    savedId = data.id;
  }

  await audit(supabase, staff, "reading", savedId, id ? "update" : "create", { module: mod, slug, title });
  updateTag("content");
  redirect(goto(base(mod), { ok: id ? "Bacaan disimpan." : "Bacaan dibuat sebagai draft." }));
}

// ---------- row actions (plain forms in the list) ----------

function readId(fd: FormData, mod: ReadingModuleName) {
  const id = text(fd, "id");
  if (!UUID_RE.test(id)) redirect(goto(base(mod), { error: "Data tidak valid." }));
  return id;
}
const back = (fd: FormData, mod: ReadingModuleName) => {
  const to = text(fd, "back");
  return to.startsWith(base(mod)) ? to : base(mod);
};

export async function setReadingStatus(fd: FormData) {
  const mod = moduleOf(fd);
  const id = readId(fd, mod);
  const to = text(fd, "to");
  if (to !== "draft" && to !== "published" && to !== "archived") redirect(goto(base(mod), { error: "Status tidak valid." }));
  const staff = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("readings").update({ publication_status: to }).eq("id", id).select("slug");
  if (error) redirect(goto(back(fd, mod), { error: dbMessage(error) }));
  if (!data?.length) redirect(goto(back(fd, mod), { error: "Tidak punya izin atau bacaan tidak ditemukan." }));
  await audit(supabase, staff, "reading", id, { published: "publish", archived: "archive", draft: "unpublish" }[to], { module: mod, slug: data[0].slug, to });
  updateTag("content");
  redirect(goto(back(fd, mod), { ok: { published: "Bacaan diterbitkan.", archived: "Bacaan diarsipkan.", draft: "Bacaan dikembalikan ke draft." }[to] }));
}

export async function setReadingActive(fd: FormData) {
  const mod = moduleOf(fd);
  const id = readId(fd, mod);
  const active = text(fd, "active") === "true";
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("readings").update({ is_active: active }).eq("id", id).select("slug");
  if (error) redirect(goto(back(fd, mod), { error: dbMessage(error) }));
  if (!data?.length) redirect(goto(back(fd, mod), { error: "Tidak punya izin atau bacaan tidak ditemukan." }));
  updateTag("content");
  redirect(goto(back(fd, mod), { ok: active ? "Bacaan diaktifkan." : "Bacaan dinonaktifkan." }));
}

export async function removeReading(fd: FormData) {
  const mod = moduleOf(fd);
  const id = readId(fd, mod);
  const staff = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("readings").delete().eq("id", id).select("slug, title");
  if (error) redirect(goto(back(fd, mod), { error: dbMessage(error) }));
  if (!data?.length) redirect(goto(back(fd, mod), { error: "Tidak ada yang terhapus." }));
  await audit(supabase, staff, "reading", id, "delete", { module: mod, slug: data[0].slug, title: data[0].title });
  updateTag("content");
  redirect(goto(back(fd, mod), { ok: "Bacaan dihapus." }));
}
