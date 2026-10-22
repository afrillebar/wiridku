import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadingReader } from "@/components/reading";
import { getListenBackgrounds } from "@/lib/content";
import { getQaris } from "@/lib/quran";
import { getTahlil } from "@/lib/tahlil";

// ponytail: a reading published after the build is rendered when first asked for (blocking); the prerendered ones stay static
export const instant = false;

export async function generateStaticParams() {
  // ponytail: a build needs at least one path; with nothing published the page answers 404
  const all = await getTahlil();
  return all.length ? all.map((r) => ({ slug: r.slug })) : [{ slug: "-" }];
}

export async function generateMetadata(props: PageProps<"/tahlil/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const r = (await getTahlil()).find((x) => x.slug === slug);
  return { title: r ? `${r.title} — Tahlil & Yasin — Wiridku` : "Tahlil & Yasin — Wiridku" };
}

export default async function TahlilReadingPage(props: PageProps<"/tahlil/[slug]">) {
  const { slug } = await props.params;
  const [readings, backgrounds, qaris] = await Promise.all([getTahlil(), getListenBackgrounds(), getQaris()]);
  if (!readings.some((r) => r.slug === slug)) notFound();
  return <ReadingReader module="tahlil" readings={readings} slug={slug} backgrounds={backgrounds} qaris={qaris} />;
}
