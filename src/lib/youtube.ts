const ID_RE = /^[A-Za-z0-9_-]{11}$/;

// Accepts watch / youtu.be / embed / shorts / live links, or a bare 11-character id. Returns the id only.
export function parseYoutubeId(input: string): string | null {
  const raw = input.trim();
  if (ID_RE.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [first, second] = url.pathname.split("/").filter(Boolean);
    id = first === "watch" ? url.searchParams.get("v") : ["embed", "shorts", "live", "v"].includes(first) ? (second ?? null) : null;
  }
  return id && ID_RE.test(id) ? id : null;
}

export function youtubeEmbedUrl(id: string, start?: number | null, end?: number | null): string {
  const q = new URLSearchParams({ rel: "0", playsinline: "1", modestbranding: "1" });
  if (start) q.set("start", String(start));
  if (end) q.set("end", String(end));
  return `https://www.youtube-nocookie.com/embed/${id}?${q}`;
}
