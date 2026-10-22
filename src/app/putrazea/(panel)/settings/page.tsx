import { saveMenus, saveSettings, saveSiteTheme } from "@/actions/settings";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { DataTable } from "@/components/admin/data-table";
import { requireAdmin } from "@/lib/auth";
import doaAudio from "@/lib/doa-audio.json";
import { MENUS, parseHiddenMenus } from "@/lib/menus";
import { AUDIO_MAX_MB_LIMIT, getAudioMaxMb } from "@/lib/settings";
import { parseSiteTheme, SITE_THEMES } from "@/lib/site-theme";
import { createClient } from "@/lib/supabase/server";
import { wiridAudio } from "@/lib/wirid-audio";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [, maxMb, { data: files }, { data: themeRow }, { data: cards }, { data: prayers }, { data: readings }] = await Promise.all([
    requireAdmin(),
    getAudioMaxMb(supabase),
    supabase.from("audio_files").select("file_size_bytes"),
    supabase.from("app_settings").select("value").eq("key", "site_theme").maybeSingle(),
    supabase.from("recitations").select("slug, phases!inner(publication_status, is_active)").eq("publication_status", "published").eq("is_active", true).eq("phases.publication_status", "published").eq("phases.is_active", true),
    supabase.from("daily_prayers").select("slug").eq("publication_status", "published").eq("is_active", true),
    supabase.from("readings").select("module").eq("publication_status", "published").eq("is_active", true),
  ]);
  const theme = parseSiteTheme(themeRow?.value);
  const hidden = parseHiddenMenus(themeRow?.value);
  const totalBytes = (files ?? []).reduce((sum, f) => sum + Number(f.file_size_bytes), 0);

  const wirid = (cards ?? []).length;
  const wiridOnline = (cards ?? []).filter((c) => c.slug in wiridAudio).length;
  const doa = (prayers ?? []).length;
  const doaOnline = (prayers ?? []).filter((p) => p.slug in doaAudio).length;
  const tahlil = (readings ?? []).filter((r) => r.module === "tahlil").length;
  const shalawat = (readings ?? []).filter((r) => r.module === "shalawat").length;
  // what each menu holds, where its sound comes from, and where it is edited
  const overview: { href: string; isi: string; audio: string; edit: { href: string; label: string } | string }[] = [
    { href: "/wirid-salat", isi: `${wirid} kartu`, audio: `${wiridOnline} online, ${wirid - wiridOnline} dari rekaman admin atau tanpa suara`, edit: { href: "/putrazea/recitations", label: "Bacaan" } },
    { href: "/alquran", isi: "114 surah", audio: "Online (Quran.com), qari dipilih pengunjung", edit: { href: "/putrazea/latar", label: "Latar mode dengar" } },
    { href: "/doa-harian", isi: `${doa} doa`, audio: `${doaOnline} dari ${doa} online`, edit: { href: "/putrazea/doa", label: "Doa Harian" } },
    { href: "/tahlil", isi: `${tahlil} bacaan`, audio: "Online (Quran.com dan Hisnul Muslim)", edit: { href: "/putrazea/readings/tahlil", label: "Tahlil" } },
    { href: "/shalawat", isi: `${shalawat} shalawat`, audio: "Online (Hisnul Muslim dan Internet Archive)", edit: { href: "/putrazea/readings/shalawat", label: "Shalawat" } },
    { href: "/tasbih", isi: "Penghitung", audio: "Tanpa audio", edit: "Tidak ada isi untuk diatur" },
    { href: "/arah-kiblat", isi: "Kompas", audio: "Tanpa audio", edit: "Tidak ada isi untuk diatur" },
    { href: "/kalender", isi: "Kalender", audio: "Tanpa audio", edit: "Tidak ada isi untuk diatur" },
    { href: "/jadwal-salat", isi: "Jadwal", audio: "Tanpa audio", edit: "Tidak ada isi untuk diatur" },
  ];

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

      <h2>Menu di Beranda</h2>
      <p className="muted">Menu yang tidak dicentang tidak muncul di Beranda. Halamannya tetap bisa dibuka lewat tautan langsung.</p>
      <ActionForm action={saveMenus} submitLabel="Simpan menu">
        <fieldset className="source-choice">
          <legend>Menu yang tampil</legend>
          {MENUS.map((m) => (
            <label key={m.href} className="check">
              <input type="checkbox" name="shown" value={m.href} defaultChecked={!hidden.includes(m.href)} /> {m.name}
            </label>
          ))}
        </fieldset>
      </ActionForm>

      <h2>Isi dan suara tiap menu</h2>
      <p className="muted">Suara semua menu diputar langsung dari internet, tidak disimpan di server. Rekaman MP3 yang diunggah admin hanya dipakai kalau sebuah bacaan Wirid tidak punya sumber online.</p>
      <DataTable
        colSpan={4}
        empty="—"
        head={
          <tr>
            <th>Menu</th>
            <th>Isi</th>
            <th>Suara</th>
            <th>Diatur di</th>
          </tr>
        }
        rows={overview.map((o) => (
          <tr key={o.href}>
            <td className="wide">
              <strong>{MENUS.find((m) => m.href === o.href)?.name}</strong>
              {hidden.includes(o.href) && (
                <>
                  <br />
                  <small className="muted">disembunyikan dari Beranda</small>
                </>
              )}
            </td>
            <td data-label="Isi">{o.isi}</td>
            <td data-label="Suara">{o.audio}</td>
            <td data-label="Diatur di">
              {typeof o.edit === "string" ? (
                <span className="muted">{o.edit}</span>
              ) : (
                <Link prefetch={false} href={o.edit.href}>
                  {o.edit.label}
                </Link>
              )}
            </td>
          </tr>
        ))}
      />

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
