// Anonymous usage events for the admin traffic page. Fire-and-forget: tracking never blocks or breaks the page.
const KEY = "wiridku-visitor";

function visitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) localStorage.setItem(KEY, (id = crypto.randomUUID()));
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function track(event: "view" | "play" | "complete", slug?: string) {
  if (typeof window === "undefined" || location.pathname.startsWith("/putrazea")) return;
  const body = JSON.stringify({
    visitor: visitorId(),
    event,
    slug,
    path: location.pathname,
    referrer: event === "view" && document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : undefined,
  });
  // ponytail: sendBeacon survives the tab closing right after a play; fetch keepalive is the fallback
  if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" })))
    fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
}
