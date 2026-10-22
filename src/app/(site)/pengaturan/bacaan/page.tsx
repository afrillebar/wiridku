import type { Metadata } from "next";
import { QuranFont } from "@/components/quran-font";
import { ReadingSettings, SubPage } from "@/components/settings";

export const metadata: Metadata = { title: "Tampilan Bacaan — Wiridku" };

export default function ReadingSettingsPage() {
  return (
    <SubPage title="Tampilan Bacaan">
      <QuranFont contents>
        <ReadingSettings />
      </QuranFont>
    </SubPage>
  );
}
