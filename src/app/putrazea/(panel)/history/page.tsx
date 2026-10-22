import { DataTable } from "@/components/admin/data-table";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ENTITY = { phase: "Fase", recitation: "Bacaan", prayer: "Doa Harian", background: "Latar Al-Qur'an", user: "Pengguna" } as Record<string, string>;

export default async function HistoryPage() {
  const supabase = await createClient();
  const [, { data: logs }] = await Promise.all([
    requireStaff(),
    supabase.from("audit_logs").select("id, entity_type, action, summary, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  return (
    <>
      <h1>Riwayat perubahan</h1>
      <p className="muted">200 aktivitas terakhir. Yang paling penting saja yang dicatat (terbit, hapus, pengguna, pengaturan), dan yang lebih tua dari 90 hari dihapus sendiri.</p>
      <DataTable
        colSpan={5}
        empty="Belum ada aktivitas."
        head={
          <tr>
            <th>Waktu (WIB)</th>
            <th>Oleh</th>
            <th>Objek</th>
            <th>Aksi</th>
            <th>Rincian</th>
          </tr>
        }
        rows={(logs ?? []).map((l) => {
          const { actor, ...rest } = (l.summary ?? {}) as Record<string, unknown>;
          return (
            <tr key={l.id}>
              <td data-label="Waktu">{new Date(l.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</td>
              <td data-label="Oleh">{String(actor ?? "—")}</td>
              <td data-label="Objek">{ENTITY[l.entity_type] ?? l.entity_type}</td>
              <td data-label="Aksi">{l.action}</td>
              <td className="wide">
                <code>{Object.entries(rest).map(([k, v]) => `${k}=${String(v)}`).join(" · ")}</code>
              </td>
            </tr>
          );
        })}
      />
    </>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
