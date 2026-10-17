"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AUDIO_MAX_MB_LIMIT } from "@/lib/settings";
import { AUDIO_SOURCE_LABEL, isAudioSource, type AudioSource } from "@/lib/audio-source";
import { isSiteTheme, SITE_THEMES } from "@/lib/site-theme";
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

export async function saveSiteTheme(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireAdmin();
  const id = text(fd, "theme");
  if (!isSiteTheme(id)) return { error: "Tema tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert({ key: "site_theme", value: { id }, updated_at: new Date().toISOString(), updated_by: staff.id });
  if (error) return { error: error.message };

  await audit(supabase, staff, "settings", null, "update", { site_theme: id });
  updateTag("content");
  const label = SITE_THEMES.find((theme) => theme.id === id)?.label ?? id;
  return { ok: `Tema tampilan depan: ${label}.` };
}

export async function saveAudioSource(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireAdmin();
  const mode = text(fd, "mode") as AudioSource;
  if (!(mode in AUDIO_SOURCE_LABEL)) return { error: "Sumber audio tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert({ key: "audio_source", value: { mode }, updated_at: new Date().toISOString(), updated_by: staff.id });
  if (error) return { error: error.message };

  const applyAll = fd.get("apply_all") === "on";
  if (applyAll) {
    const { error: cleared } = await supabase.from("recitations").update({ audio_source: null }).not("id", "is", null);
    if (cleared) return { error: cleared.message };
  }

  await audit(supabase, staff, "settings", null, "update", { audio_source: mode, apply_all: applyAll });
  updateTag("content");
  return { ok: applyAll ? `Semua bacaan memakai ${AUDIO_SOURCE_LABEL[mode]}.` : `Pilihan untuk semua: ${AUDIO_SOURCE_LABEL[mode]}. Bacaan yang punya pilihan sendiri tidak berubah.` };
}

export async function saveCardAudioSources(_prev: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireAdmin();
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("recitations").select("id, audio_source");
  if (error) return { error: error.message };

  const changes: { id: string; audio_source: AudioSource | null }[] = [];
  for (const row of rows ?? []) {
    const raw = fd.get(`source:${row.id}`);
    if (raw === null) continue;
    const picked = String(raw);
    if (picked !== "default" && !isAudioSource(picked)) return { error: "Sumber audio tidak valid." };
    const next = picked === "default" ? null : picked;
    if (next !== (row.audio_source ?? null)) changes.push({ id: row.id, audio_source: next });
  }

  for (const change of changes) {
    const { error: up } = await supabase.from("recitations").update({ audio_source: change.audio_source }).eq("id", change.id);
    if (up) return { error: up.message };
  }

  await audit(supabase, staff, "settings", null, "update", { card_audio_sources: changes.length });
  updateTag("content");
  return { ok: changes.length ? `Sumber ${changes.length} bacaan disimpan.` : "Tidak ada perubahan pada sumber per bacaan." };
}
