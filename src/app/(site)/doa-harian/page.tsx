import type { Metadata } from "next";
import { ReadingIndex } from "@/components/reading";
import { DOA_GROUPS, getDoaReadings } from "@/lib/doa-readings";

export const metadata: Metadata = { title: "Doa Harian — Wiridku" };

export default async function DoaHarianPage() {
  const readings = await getDoaReadings();
  const present = DOA_GROUPS.filter((g) => readings.some((r) => r.group === g.id));
  return <ReadingIndex module="doa" readings={readings} groups={present} />;
}
