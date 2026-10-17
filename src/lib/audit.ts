import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Staff } from "@/lib/auth";

export async function audit(
  supabase: SupabaseClient,
  actor: Staff,
  entityType: "phase" | "recitation" | "user" | "audio" | "settings" | "visit",
  entityId: string | null,
  action: string,
  summary: Record<string, unknown> = {},
) {
  // ponytail: the log is best-effort so a failed insert never blocks the edit that already succeeded
  await supabase
    .from("audit_logs")
    .insert({ entity_type: entityType, entity_id: entityId, action, changed_by: actor.id, summary: { actor: actor.email, ...summary } });
}
