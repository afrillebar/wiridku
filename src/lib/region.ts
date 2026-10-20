// Turns GPS coordinates into the name of the kota/kabupaten ("Jakarta Pusat", "Kota Bandung", "Kabupaten Sleman").
// Called from the browser: BigDataCloud's client endpoint is built for that, OpenStreetMap's Nominatim is the fallback.
// The name is only a label; the prayer times are calculated from the coordinates themselves.

export type Region = { name: string; province?: string };

type Level = { adminLevel?: number; name?: string; description?: string };
type NominatimAddress = Record<string, string | undefined>;

const PROVINCE: Record<string, string> = { "Daerah Khusus Ibukota Jakarta": "DKI Jakarta", Jakarta: "DKI Jakarta", "Daerah Istimewa Yogyakarta": "DI Yogyakarta", Yogyakarta: "DI Yogyakarta" };
const province = (p?: string) => (p ? (PROVINCE[p] ?? p) : undefined);

// "Bandung" + Kota -> "Kota Bandung"; Jakarta's five areas ("Jakarta Pusat") are never prefixed
function named(type: "Kota" | "Kabupaten" | null, name: string) {
  const n = name.trim();
  if (/^(kota|kabupaten)\s/i.test(n) || /^jakarta\b/i.test(n)) return n;
  if (/^kab\.?\s/i.test(n)) return n.replace(/^kab\.?\s+/i, "Kabupaten ");
  return type ? `${type} ${n}` : n;
}

export function regionFromBigDataCloud(body: { localityInfo?: { administrative?: Level[] } } | null): Region | null {
  const levels = body?.localityInfo?.administrative ?? [];
  const area = levels.find((l) => l.adminLevel === 5 && l.name);
  if (!area?.name) return null;
  // its description says what kind of area it is: "kota di Provinsi …", "kabupaten di Provinsi …", "ibukota Provinsi …"
  const d = (area.description ?? "").toLowerCase();
  const type = /^(kota|ibukota)/.test(d) ? "Kota" : /^kabupaten/.test(d) ? "Kabupaten" : null;
  return { name: named(type, area.name), province: province(levels.find((l) => l.adminLevel === 4)?.name) };
}

export function regionFromNominatim(a: NominatimAddress | null | undefined): Region | null {
  if (!a) return null;
  const prov = province(a.state);
  if (a.city_district && /^jakarta/i.test(a.city_district)) return { name: a.city_district, province: prov ?? "DKI Jakarta" };
  // OSM tags a whole province as "city" for the thousand islands off Jakarta; that is no use as a place name
  if (a.city && !/^daerah (khusus|istimewa)/i.test(a.city)) return { name: named("Kota", a.city), province: prov };
  const county = a.county ?? a.region;
  return county ? { name: named("Kabupaten", county), province: prov } : null;
}

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function lookupRegion(lat: number, lon: number): Promise<Region | null> {
  try {
    const region = regionFromBigDataCloud(await getJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`));
    if (region) return region;
  } catch {}
  try {
    return regionFromNominatim((await getJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&accept-language=id`)).address);
  } catch {
    return null;
  }
}
