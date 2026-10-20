import { cacheLife } from "next/cache";
import { connection } from "next/server";
import type { City } from "@/lib/prayer";
import provinces from "@/lib/city-provinces.json";

// Kemenag publishes one schedule for all of Jakarta; the five areas are listed too because that is what people (and GPS) call their place
const JAKARTA_AREAS = ["PUSAT", "UTARA", "BARAT", "SELATAN", "TIMUR"].map((a): City => ({ id: "1301", lokasi: `JAKARTA ${a}`, daerah: "DKI JAKARTA" }));

// All kabupaten/kota that have a Kemenag schedule (about 500); the city picker filters this list in the browser.
async function getCities(): Promise<City[]> {
  "use cache";
  cacheLife("weeks");

  const res = await fetch("https://api.myquran.com/v2/sholat/kota/semua", { signal: AbortSignal.timeout(15000) });
  const body = await res.json();
  if (!res.ok || !body?.status || !Array.isArray(body.data)) throw new Error(`kota: ${res.status}`);
  // the list has no province; city-provinces.json (id -> daerah) was collected once from each city's own schedule answer
  const known = provinces as Record<string, string>;
  return body.data.flatMap((c: City): City[] => {
    const city = { id: String(c.id), lokasi: c.lokasi, daerah: known[String(c.id)] };
    return city.id === "1301" ? [city, ...JAKARTA_AREAS] : [city];
  });
}

export async function GET() {
  // ponytail: run at request time; otherwise a failed fetch during the build would be frozen in as the response
  await connection();
  try {
    return Response.json(await getCities());
  } catch {
    return Response.json({ error: "Daftar kota sedang tidak bisa diambil." }, { status: 502 });
  }
}
