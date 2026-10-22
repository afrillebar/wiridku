import { createHash } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const EVENTS = new Set(["view", "play", "complete", "place"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget/i;
const KEEP_DAYS = 60;

const clip = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : null);
// ponytail: Vercel sends geo headers URL-encoded (e.g. "Jakarta%20Selatan")
const geo = (req: NextRequest, name: string) => {
  const v = req.headers.get(name);
  try {
    return v ? decodeURIComponent(v) : null;
  } catch {
    return v;
  }
};

function parseAgent(ua: string) {
  const device = /iPad|Tablet|(Android(?!.*Mobile))/i.test(ua) ? "tablet" : /Mobi|iPhone|Android/i.test(ua) ? "mobile" : "desktop";
  const browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Lainnya";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Lainnya";
  return { device, browser, os };
}

// Records one page view or audio event. Always answers 204 so the page never waits on or reacts to tracking.
export async function POST(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  const body = await request.json().catch(() => null);
  if (!body || BOT.test(ua) || !UUID.test(body.visitor ?? "") || !EVENTS.has(body.event) || typeof body.path !== "string") return new Response(null, { status: 204 });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.SUPABASE_SECRET_KEY ?? "";

  const place = typeof body.place === "string" && body.place.trim() ? clip(body.place.trim(), 80) : null;

  after(async () => {
    const db = createServiceClient();
    // the area name is known only after the visitor allowed location, i.e. after the first view was logged: fill it in on their recent rows
    if (body.event === "place") {
      if (place) await db.from("visit_events").update({ place }).eq("visitor_id", body.visitor).is("place", null).gte("created_at", new Date(Date.now() - 30 * 60e3).toISOString());
      return;
    }
    const claims = await (await createClient()).auth.getClaims().catch(() => null);
    const row = {
      visitor_id: body.visitor,
      user_id: claims?.data?.claims?.sub ?? null,
      event: body.event,
      path: body.path.slice(0, 200),
      slug: typeof body.slug === "string" && /^[a-z0-9-]{1,80}$/.test(body.slug) ? body.slug : null,
      country: clip(geo(request, "x-vercel-ip-country"), 8),
      region: clip(geo(request, "x-vercel-ip-country-region"), 80),
      city: clip(geo(request, "x-vercel-ip-city"), 80),
      ...parseAgent(ua),
      referrer: typeof body.referrer === "string" && body.referrer ? clip(body.referrer, 200) : null,
      ip_hash: ip ? createHash("sha256").update(`${day}:${salt}:${ip}`).digest("hex").slice(0, 32) : null,
    };
    // ponytail: the place column comes with migration 0015; until it exists, still log the visit without it
    const { error } = await db.from("visit_events").insert({ ...row, place });
    if (error && place) await db.from("visit_events").insert(row);
    // ponytail: no cron on the free plan, so roughly one request in a hundred clears rows past the retention window
    if (Math.random() < 0.01) await db.from("visit_events").delete().lt("created_at", new Date(Date.now() - KEEP_DAYS * 864e5).toISOString());
  });
  return new Response(null, { status: 204 });
}
