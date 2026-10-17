"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { goto, text } from "@/lib/form";

const back = (hari: string) => (/^\d+$/.test(hari) ? `/putrazea/traffic?hari=${hari}` : "/putrazea/traffic");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteVisitLog(fd: FormData) {
  const staff = await requireAdmin();
  const hari = text(fd, "hari");
  const scope = text(fd, "scope");
  const id = text(fd, "id");
  const kind = text(fd, "kind");

  let rpcScope = "";
  let target: string | null = null;
  if (scope === "all") rpcScope = "all";
  else if (scope === "visitor" && UUID.test(id) && (kind === "user" || kind === "visitor")) {
    rpcScope = kind;
    target = id;
  } else if (scope === "one" && /^\d+$/.test(id)) {
    rpcScope = "one";
    target = id;
  } else redirect(goto(back(hari), { error: "Catatan log tidak valid." }));

  const db = createServiceClient();
  const { data, error } = await db.rpc("delete_visit_log", { scope: rpcScope, target });
  if (error) redirect(goto(back(hari), { error: error.message }));
  const removed = Number(data ?? 0);

  await audit(await createClient(), staff, "visit", null, rpcScope === "all" ? "delete-all" : rpcScope === "one" ? "delete" : "delete-visitor", {
    removed,
    ...(target ? { id: target } : {}),
  });
  revalidatePath("/putrazea/traffic");
  revalidatePath("/putrazea");
  const ok =
    rpcScope === "all"
      ? removed
        ? `${removed} catatan log dihapus.`
        : "Log akses sudah kosong."
      : rpcScope === "one"
        ? removed
          ? "Satu catatan log dihapus."
          : "Catatan log tidak ditemukan."
        : removed
          ? `${removed} catatan log pengguna ini dihapus.`
          : "Pengguna ini tidak punya log.";
  if (!removed && rpcScope !== "all") redirect(goto(back(hari), { error: ok }));
  redirect(goto(back(hari), { ok }));
}
