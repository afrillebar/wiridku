import type { Metadata } from "next";
import { InstallSettings, SubPage } from "@/components/settings";

export const metadata: Metadata = { title: "Pasang Aplikasi — Wiridku" };

export default function InstallPage() {
  return (
    <SubPage title="Pasang Aplikasi">
      <InstallSettings />
    </SubPage>
  );
}
