import type { Metadata } from "next";
import { LocationSettings, SubPage } from "@/components/settings";

export const metadata: Metadata = { title: "Lokasi & Jadwal Salat — Wiridku" };

export default function LocationPage() {
  return (
    <SubPage title="Lokasi & Jadwal Salat">
      <LocationSettings />
    </SubPage>
  );
}
