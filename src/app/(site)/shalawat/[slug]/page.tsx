import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingReader } from "@/components/reading";
import { getListenBackgrounds } from "@/lib/content";
import { getShalawat } from "@/lib/shalawat";

// ponytail: a reading published after the build is rendered when first asked for (blocking); the prerendered ones stay static
export const instant = false;

export async function generateStaticParams() {
  // ponytail: a build needs at least one path; with nothing published the page answers 404
  const all = await getShalawat();
  return all.length ? all.map((r) => ({ slug: r.slug })) : [{ slug: "-" }];
}

export async function generateMetadata(props: PageProps<"/shalawat/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const r = (await getShalawat()).find((x) => x.slug === slug);
  return { title: r ? `${r.title} — Shalawat — Wiridku` : "Shalawat — Wiridku" };
}

export default async function ShalawatReadingPage(props: PageProps<"/shalawat/[slug]">) {
  const { slug } = await props.params;
  const [readings, backgrounds] = await Promise.all([getShalawat(), getListenBackgrounds()]);
  if (!readings.some((r) => r.slug === slug)) notFound();
  return <ReadingReader module="shalawat" readings={readings} slug={slug} backgrounds={backgrounds} />;
}
