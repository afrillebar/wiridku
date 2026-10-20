import type { Metadata } from "next";
import { WiridApp } from "@/components/wirid-app";
import { getPublishedPhases } from "@/lib/content";

export const metadata: Metadata = { title: "Wirid Salat — Wiridku" };

export default async function WiridSalatPage() {
  return <WiridApp phases={await getPublishedPhases()} />;
}
