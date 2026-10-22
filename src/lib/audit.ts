import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Staff } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

// only what matters later is kept: publishing, deleting, who may sign in, and what changed in the site; moving rows around and switching things on and off is not
const MINOR = new Set(["reorder", "activate", "deactivate", "update-info"]);
const KEEP_DAYS = 90;

export async function audit(
  supabase: SupabaseClient,
  actor: Staff,
  entityType: "phase" | "recitation" | "prayer" | "reading" | "background" | "user" | "audio" | "settings" | "visit",
  entityId: string | null,
  action: string,
  summary: Record<string, unknown> = {},
) {
  if (entityType !== "user" && MINOR.has(action)) return;
  // ponytail: the log is best-effort so a failed insert never blocks the edit that already succeeded
  await supabase
    .from("audit_logs")
    .insert({ entity_type: entityType, entity_id: entityId, action, changed_by: actor.id, summary: { actor: actor.email, ...summary } });
  // ponytail: no cron on the free plan, so now and then a write clears the rows past the retention window
  if (Math.random() < 0.05) await createServiceClient().from("audit_logs").delete().lt("created_at", new Date(Date.now() - KEEP_DAYS * 864e5).toISOString());
}
