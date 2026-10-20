import type { Metadata } from "next";
import { QuranIndex } from "@/components/quran";
import { getSurahs } from "@/lib/quran";

export const metadata: Metadata = { title: "Al-Qur'an — Wiridku" };

export default async function QuranPage() {
  return <QuranIndex surahs={await getSurahs()} />;
}
