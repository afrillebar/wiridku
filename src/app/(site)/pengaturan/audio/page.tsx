import type { Metadata } from "next";
import { AudioSettings, SubPage } from "@/components/settings";

export const metadata: Metadata = { title: "Audio — Wiridku" };

export default function AudioPage() {
  return (
    <SubPage title="Audio">
      <AudioSettings />
    </SubPage>
  );
}
