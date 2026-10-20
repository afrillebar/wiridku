import type { Metadata } from "next";
import { Kalender } from "@/components/calendar";

export const metadata: Metadata = { title: "Kalender — Wiridku" };

export default function KalenderPage() {
  return <Kalender />;
}
