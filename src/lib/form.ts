export type FormState = { error?: string; ok?: string } | null;

export const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
export const textOrNull = (fd: FormData, key: string) => text(fd, key) || null;

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export const goto = (path: string, params: { ok?: string; error?: string }) => {
  const q = new URLSearchParams();
  if (params.ok) q.set("ok", params.ok);
  if (params.error) q.set("error", params.error);
  const qs = q.toString();
  return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
};
