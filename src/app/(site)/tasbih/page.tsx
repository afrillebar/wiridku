import type { Metadata } from "next";
import { Tasbih } from "@/components/tasbih";

export const metadata: Metadata = { title: "Tasbih — Wiridku" };

export default function TasbihPage() {
  return <Tasbih />;
}
