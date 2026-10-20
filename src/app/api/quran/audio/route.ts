import type { NextRequest } from "next/server";
import { getQaris, getRecitation, isSurahId } from "@/lib/quran";

// GET /api/quran/audio?qari=7&surah=18 — the surah's audio file and where each verse starts and ends in it.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const qari = Number(q.get("qari"));
  const surah = Number(q.get("surah"));
  if (!isSurahId(surah) || !Number.isInteger(qari)) return Response.json({ error: "Parameter qari atau surah tidak valid." }, { status: 400 });

  try {
    if (!(await getQaris()).some((r) => r.id === qari)) return Response.json({ error: "Qari tidak dikenal." }, { status: 400 });
    const data = await getRecitation(qari, surah);
    return Response.json(data, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return Response.json({ error: "Murotal sedang tidak bisa diambil." }, { status: 502 });
  }
}
