import type { Metadata } from "next";
import { AdzanSettings, SubPage } from "@/components/settings";

export const metadata: Metadata = { title: "Adzan & Notifikasi — Wiridku" };

export default function AdzanPage() {
  return (
    <SubPage title="Adzan & Notifikasi">
      <AdzanSettings />
    </SubPage>
  );
}
