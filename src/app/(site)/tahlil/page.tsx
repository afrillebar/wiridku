import type { Metadata } from "next";
import { ReadingIndex } from "@/components/reading";
import { getTahlil } from "@/lib/tahlil";

export const metadata: Metadata = { title: "Tahlil & Yasin — Wiridku" };

export default async function TahlilPage() {
  return <ReadingIndex module="tahlil" readings={await getTahlil()} />;
}
