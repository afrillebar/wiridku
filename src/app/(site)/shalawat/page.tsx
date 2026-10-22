import type { Metadata } from "next";
import { ReadingIndex } from "@/components/reading";
import { getShalawat } from "@/lib/shalawat";

export const metadata: Metadata = { title: "Shalawat — Wiridku" };

export default async function ShalawatPage() {
  return <ReadingIndex module="shalawat" readings={await getShalawat()} />;
}
