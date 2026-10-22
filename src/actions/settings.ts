"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AUDIO_MAX_MB_LIMIT } from "@/lib/settings";
import { MENUS, parseHiddenMenus } from "@/lib/menus";
import { isSiteTheme, parseSiteTheme, SITE_THEMES } from "@/lib/site-theme";
import { text, type FormState } from "@/lib/form";

export async function saveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireAdmin();
  const maxMb = Number(text(fd, "audio_max_mb"));
  if (!Number.isInteger(maxMb) || maxMb < 1 || maxMb > AUDIO_MAX_MB_LIMIT) return { error: `Batas ukuran audio harus 1–${AUDIO_MAX_MB_LIMIT} MB.` };

  // ponytail: the bucket limit is what Storage enforces; the settings row only feeds the form's early check
  const { error: bucketError } = await createServiceClient().storage.updateBucket("audio", {
    public: false,
    fileSizeLimit: maxMb * 1024 * 1024,
    allowedMimeTypes: ["audio/mpeg"],
  });
  if (bucketError) return { error: `Gagal mengubah batas di Storage: ${bucketError.message}` };

  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert({ key: "audio", value: { max_mb: maxMb }, updated_at: new Date().toISOString(), updated_by: staff.id });
  if (error) return { error: error.message };

  await audit(supabase, staff, "settings", null, "update", { audio_max_mb: maxMb });
  return { ok: "Pengaturan disimpan." };
}

// the theme and the hidden menus live in one row, so saving one keeps the other
async function siteRow(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "site_theme").maybeSingle();
  return { id: parseSiteTheme(data?.value), hidden: parseHiddenMenus(data?.value) };
}

export async function saveSiteTheme(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireAdmin();
  const id = text(fd, "theme");
  if (!isSiteTheme(id)) return { error: "Tema tidak valid." };

  const supabase = await createClient();
  const { hidden } = await siteRow(supabase);
  const { error } = await supabase.from("app_settings").upsert({ key: "site_theme", value: { id, hidden }, updated_at: new Date().toISOString(), updated_by: staff.id });
  if (error) return { error: error.message };

  await audit(supabase, staff, "settings", null, "update", { site_theme: id });
  updateTag("content");
  const label = SITE_THEMES.find((theme) => theme.id === id)?.label ?? id;
  return { ok: `Tema tampilan depan: ${label}.` };
}

export async function saveMenus(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireAdmin();
  const shown = fd.getAll("shown").map(String);
  const hidden = MENUS.map((m) => m.href).filter((href) => !shown.includes(href));
  if (hidden.length === MENUS.length) return { error: "Sisakan minimal satu menu di Beranda." };

  const supabase = await createClient();
  const { id } = await siteRow(supabase);
  const { error } = await supabase.from("app_settings").upsert({ key: "site_theme", value: { id, hidden }, updated_at: new Date().toISOString(), updated_by: staff.id });
  if (error) return { error: error.message };

  await audit(supabase, staff, "settings", null, "update", { menus_hidden: hidden.length });
  updateTag("content");
  return { ok: hidden.length ? `${hidden.length} menu disembunyikan dari Beranda.` : "Semua menu tampil di Beranda." };
}
