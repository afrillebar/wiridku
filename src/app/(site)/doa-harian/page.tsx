import type { Metadata } from "next";
import { DoaHarian } from "@/components/doa";
import { getPublishedPrayers } from "@/lib/content";
import type { DoaAudio } from "@/lib/doa";
import audio from "@/lib/doa-audio.json";

export const metadata: Metadata = { title: "Doa Harian — Wiridku" };

export default async function DoaHarianPage() {
  return <DoaHarian prayers={await getPublishedPrayers()} audio={audio as DoaAudio} />;
}
