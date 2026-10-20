import type { Metadata } from "next";
import { DataSettings, SubPage } from "@/components/settings";

export const metadata: Metadata = { title: "Penyimpanan Data — Wiridku" };

export default function DataPage() {
  return (
    <SubPage title="Penyimpanan Data">
      <DataSettings />
    </SubPage>
  );
}
