import type { Metadata } from "next";
import { SettingsMenu, SubPage } from "@/components/settings";

export const metadata: Metadata = { title: "Pengaturan — Wiridku" };

export default function SettingsPage() {
  return (
    <SubPage title="Pengaturan" back="/">
      <SettingsMenu />
    </SubPage>
  );
}
