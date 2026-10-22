import type { Metadata } from "next";
import { ReadingIndex } from "@/components/reading";
import { getPublishedPhases } from "@/lib/content";
import { wiridReadings } from "@/lib/wirid-readings";

export const metadata: Metadata = { title: "Wirid Salat — Wiridku" };

export default async function WiridSalatPage() {
  return <ReadingIndex module="wirid" readings={wiridReadings(await getPublishedPhases())} />;
}
