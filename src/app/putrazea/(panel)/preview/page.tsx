import { WiridApp } from "@/components/wirid-app";
import { RECITATION_COLUMNS, withAudioUrls, type RawPhase } from "@/lib/content";
import { requireStaff } from "@/lib/auth";
import { parseAudioSource } from "@/lib/audio-source";
import { createClient } from "@/lib/supabase/server";

export default async function PreviewPage() {
  const supabase = await createClient();
  const [, { data }, { data: sourceRow }] = await Promise.all([
    requireStaff(),
    supabase
    .from("phases")
    .select(
      `id, slug, continue_numbering, title, description, publication_status, recitations(${RECITATION_COLUMNS}, publication_status)`,
    )
    .neq("publication_status", "archived")
    .order("sort_order")
    .order("sort_order", { referencedTable: "recitations" }),
    supabase.from("app_settings").select("value").eq("key", "audio_source").maybeSingle(),
  ]);

  const raw = (data ?? []).map((p) => ({
    ...p,
    recitations: p.recitations.filter((r) => r.publication_status !== "archived"),
  })) as unknown as RawPhase[];
  // preview numbers every non-archived card, so drafts show the number they would get once published
  const source = parseAudioSource(sourceRow?.value);
  const phases = await withAudioUrls(supabase, raw, source);

  return (
    <div className="preview">
      <p className="msg warn preview-banner">
        Pratinjau: menampilkan semua fase dan bacaan termasuk draft, apa adanya seperti tampilan publik. Centang di sini tidak disimpan.
      </p>
      <WiridApp phases={phases} preview />
    </div>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
