import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingReader } from "@/components/reading";
import { getListenBackgrounds, getPublishedPhases } from "@/lib/content";
import { wiridReadings } from "@/lib/wirid-readings";

// ponytail: a reading published after the build is rendered when first asked for (blocking); the prerendered ones stay static
export const instant = false;

export async function generateStaticParams() {
  return wiridReadings(await getPublishedPhases()).map((r) => ({ slug: r.slug }));
}

export async function generateMetadata(props: PageProps<"/wirid-salat/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const r = wiridReadings(await getPublishedPhases()).find((x) => x.slug === slug);
  return { title: r ? `${r.title} — Wirid Salat — Wiridku` : "Wirid Salat — Wiridku" };
}

export default async function WiridReadingPage(props: PageProps<"/wirid-salat/[slug]">) {
  const { slug } = await props.params;
  const [phases, backgrounds] = await Promise.all([getPublishedPhases(), getListenBackgrounds()]);
  const readings = wiridReadings(phases);
  if (!readings.some((r) => r.slug === slug)) notFound();
  return <ReadingReader module="wirid" readings={readings} slug={slug} backgrounds={backgrounds} />;
}
