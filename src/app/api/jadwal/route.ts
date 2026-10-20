import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";
import { isCityId, type DaySchedule, type MonthSchedule } from "@/lib/prayer";

const SOURCE = "https://api.myquran.com/v2/sholat/jadwal";

// One month of Kemenag times for one city. Failures throw, so they are never cached.
async function getMonth(id: string, year: number, month: number): Promise<MonthSchedule> {
  "use cache";
  cacheLife("days");

  const res = await fetch(`${SOURCE}/${id}/${year}/${month}`, { signal: AbortSignal.timeout(15000) });
  const body = await res.json();
  if (!res.ok || !body?.status || !Array.isArray(body.data?.jadwal)) throw new Error(`jadwal ${id} ${year}-${month}: ${res.status}`);
  const pick = (d: Record<string, string>): DaySchedule => ({
    date: d.date,
    imsak: d.imsak,
    subuh: d.subuh,
    terbit: d.terbit,
    dzuhur: d.dzuhur,
    ashar: d.ashar,
    maghrib: d.maghrib,
    isya: d.isya,
  });
  return { id: String(body.data.id), lokasi: body.data.lokasi, daerah: body.data.daerah, jadwal: body.data.jadwal.map(pick) };
}

// GET /api/jadwal?kota=1301&tahun=2026&bulan=10 — also returns the server clock so the page can correct a wrong device clock.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const id = q.get("kota");
  const year = Number(q.get("tahun"));
  const month = Number(q.get("bulan"));
  if (!isCityId(id) || !Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12)
    return Response.json({ error: "Parameter kota, tahun, atau bulan tidak valid." }, { status: 400 });

  try {
    const data = await getMonth(id, year, month);
    return Response.json({ ...data, serverTime: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Jadwal dari Kemenag sedang tidak bisa diambil.", serverTime: Date.now() }, { status: 502 });
  }
}
