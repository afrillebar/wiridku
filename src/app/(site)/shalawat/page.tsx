import type { Metadata } from "next";
import { Shalawat } from "@/components/tahlil";
import shalawat from "@/lib/shalawat.json";

export const metadata: Metadata = { title: "Shalawat — Wiridku" };

export default function ShalawatPage() {
  const parts = shalawat.map((s) => ({
    slug: s.slug,
    title: s.title,
    note: s.note,
    ref: s.ref,
    lines: s.blocks.map((b) => ({ ar: b.ar, la: b.la, ti: b.ti })),
    clips: s.clips.map((c) => ({ url: c.url, ...("from" in c ? { from: c.from } : {}), ...("to" in c ? { to: c.to } : {}) })),
  }));
  return <Shalawat parts={parts} />;
}
