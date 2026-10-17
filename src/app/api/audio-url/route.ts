import { NextResponse, type NextRequest } from "next/server";
import { resolveAudioSource } from "@/lib/audio-source";
import { SIGNED_URL_SECONDS, createAnonClient, getAudioSource } from "@/lib/content";

type Row = { storage_path: string; audio_version: number; synthetic: boolean };

// Fresh signed URL for the file kind this card currently uses, for players whose page outlived the old link.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });

  const db = createAnonClient();
  const [{ data }, site] = await Promise.all([
    db.from("recitations").select("audio_source, audio_files(storage_path, audio_version, synthetic)").eq("slug", slug).maybeSingle(),
    getAudioSource(),
  ]);
  const source = resolveAudioSource(data?.audio_source, site);
  if (source !== "mp3" && source !== "tts") return NextResponse.json({ error: "not found" }, { status: 404 });

  const raw = data?.audio_files as unknown as Row | Row[] | null;
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const audio = rows.find((r) => r.synthetic === (source === "tts"));
  if (!audio) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: signed } = await db.storage.from("audio").createSignedUrl(audio.storage_path, SIGNED_URL_SECONDS);
  if (!signed?.signedUrl) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ url: signed.signedUrl, version: audio.audio_version }, { headers: { "Cache-Control": "no-store" } });
}
