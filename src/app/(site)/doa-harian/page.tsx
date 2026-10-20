import type { Metadata } from "next";
import { DoaHarian } from "@/components/doa";
import { getPublishedPrayers } from "@/lib/content";

export const metadata: Metadata = { title: "Doa Harian — Wiridku" };

export default async function DoaHarianPage() {
  return <DoaHarian prayers={await getPublishedPrayers()} />;
}
