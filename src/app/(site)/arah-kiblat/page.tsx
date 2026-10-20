import type { Metadata } from "next";
import { ArahKiblat } from "@/components/qibla";

export const metadata: Metadata = { title: "Arah Kiblat — Wiridku" };

export default function ArahKiblatPage() {
  return <ArahKiblat />;
}
