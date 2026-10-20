import type { Metadata } from "next";
import { JadwalBulanan } from "@/components/schedule";

export const metadata: Metadata = { title: "Jadwal Salat — Wiridku" };

export default function JadwalSalatPage() {
  return <JadwalBulanan />;
}
