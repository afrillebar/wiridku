import { RECITATION_COLUMNS, withAudioUrls, type Phase, type RawPhase } from "@/lib/content";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Every phase and card that is not archived, drafts included, as the public site would show them once published.
export async function getPreviewPhases(): Promise<Phase[]> {
  const supabase = await createClient();
  const [, { data }] = await Promise.all([
    requireStaff(),
    supabase
      .from("phases")
      .select(`id, slug, continue_numbering, title, description, publication_status, recitations(${RECITATION_COLUMNS}, publication_status)`)
      .neq("publication_status", "archived")
      .order("sort_order")
      .order("sort_order", { referencedTable: "recitations" }),
  ]);

  const raw = (data ?? []).map((p) => ({
    ...p,
    recitations: p.recitations.filter((r) => r.publication_status !== "archived"),
  })) as unknown as RawPhase[];
  // preview numbers every non-archived card, so drafts show the number they would get once published
  return withAudioUrls(supabase, raw);
}
