import type { Metadata } from "next";
import { Tahlil } from "@/components/tahlil";
import { getTahlil } from "@/lib/tahlil";

export const metadata: Metadata = { title: "Tahlil & Yasin — Wiridku" };

export default async function TahlilPage() {
  return <Tahlil parts={await getTahlil()} />;
}
