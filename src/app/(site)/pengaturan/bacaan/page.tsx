import type { Metadata } from "next";
import { ReadingSettings, SubPage } from "@/components/settings";

export const metadata: Metadata = { title: "Tampilan Bacaan — Wiridku" };

export default function ReadingSettingsPage() {
  return (
    <SubPage title="Tampilan Bacaan">
      <ReadingSettings />
    </SubPage>
  );
}
