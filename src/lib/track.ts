// Anonymous usage events for the admin traffic page. Fire-and-forget: tracking never blocks or breaks the page.
import { uuid } from "./uuid";

const KEY = "wiridku-visitor";

function visitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) localStorage.setItem(KEY, (id = uuid()));
    return id;
  } catch {
    return uuid();
  }
}

// The area name of a GPS-detected place ("Jakarta Pusat, DKI Jakarta"). Never coordinates.
function place(): string | undefined {
  try {
    const c = JSON.parse(localStorage.getItem("wiridku_kota_v1") ?? "null");
    return c?.gps && c.lokasi !== "Lokasi GPS" ? [c.lokasi, c.daerah].filter(Boolean).join(", ") : undefined;
  } catch {
    return undefined;
  }
}

// "place" is sent once a GPS place is known; the server adds it to this visitor's latest rows, which were logged before it was
export function track(event: "view" | "play" | "complete" | "place", slug?: string) {
  if (typeof window === "undefined" || location.pathname.startsWith("/putrazea")) return;
  // ponytail: one failure here (an unusual browser, a blocked API) must never take the page down with it
  try {
    const body = JSON.stringify({
      visitor: visitorId(),
      event,
      slug,
      path: location.pathname,
      place: place(),
      referrer: event === "view" && document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : undefined,
    });
    // sendBeacon survives the tab closing right after a play; fetch keepalive is the fallback
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" })))
      fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {}
}
