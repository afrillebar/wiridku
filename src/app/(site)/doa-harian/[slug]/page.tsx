import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingReader } from "@/components/reading";
import { getListenBackgrounds } from "@/lib/content";
import { getDoaReadings } from "@/lib/doa-readings";

// ponytail: a reading published after the build is rendered when first asked for (blocking); the prerendered ones stay static
export const instant = false;

export async function generateStaticParams() {
  return (await getDoaReadings()).map((r) => ({ slug: r.slug }));
}

export async function generateMetadata(props: PageProps<"/doa-harian/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const r = (await getDoaReadings()).find((x) => x.slug === slug);
  return { title: r ? `${r.title} — Doa Harian — Wiridku` : "Doa Harian — Wiridku" };
}

export default async function DoaPage(props: PageProps<"/doa-harian/[slug]">) {
  const { slug } = await props.params;
  const [readings, backgrounds] = await Promise.all([getDoaReadings(), getListenBackgrounds()]);
  if (!readings.some((r) => r.slug === slug)) notFound();
  return <ReadingReader module="doa" readings={readings} slug={slug} backgrounds={backgrounds} />;
}
