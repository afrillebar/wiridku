"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { goto, text } from "@/lib/form";

const back = (hari: string) => (/^\d+$/.test(hari) ? `/putrazea/traffic?hari=${hari}` : "/putrazea/traffic");

export async function deleteVisitLog(fd: FormData) {
  const staff = await requireAdmin();
  const hari = text(fd, "hari");
  const scope = text(fd, "scope");
  const db = createServiceClient();

  if (scope === "all") {
    let removed = 0;
    for (;;) {
      const { data, error } = await db.from("visit_events").select("id").limit(1000);
      if (error) redirect(goto(back(hari), { error: error.message }));
      if (!data?.length) break;
      const ids = data.map((row) => row.id);
      const deleted = await db.from("visit_events").delete().in("id", ids);
      if (deleted.error) redirect(goto(back(hari), { error: deleted.error.message }));
      removed += ids.length;
      if (ids.length < 1000) break;
    }
    await audit(await createClient(), staff, "visit", null, "delete-all", { removed });
    revalidatePath("/putrazea/traffic");
    revalidatePath("/putrazea");
    redirect(goto(back(hari), { ok: removed ? `${removed} catatan log dihapus.` : "Log akses sudah kosong." }));
  }

  const id = text(fd, "id");
  if (scope !== "one" || !/^\d+$/.test(id)) redirect(goto(back(hari), { error: "Catatan log tidak valid." }));
  const { data, error } = await db.from("visit_events").delete().eq("id", id).select("id");
  if (error) redirect(goto(back(hari), { error: error.message }));
  if (!data?.length) redirect(goto(back(hari), { error: "Catatan log tidak ditemukan." }));

  await audit(await createClient(), staff, "visit", null, "delete", { id });
  revalidatePath("/putrazea/traffic");
  revalidatePath("/putrazea");
  redirect(goto(back(hari), { ok: "Satu catatan log dihapus." }));
}
