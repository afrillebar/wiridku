import type { Metadata } from "next";
import { DisplaySettings, SubPage } from "@/components/settings";
import { getSiteTheme } from "@/lib/content";

export const metadata: Metadata = { title: "Tampilan — Wiridku" };

export default async function DisplayPage() {
  return (
    <SubPage title="Tampilan">
      <DisplaySettings siteTheme={await getSiteTheme()} />
    </SubPage>
  );
}
