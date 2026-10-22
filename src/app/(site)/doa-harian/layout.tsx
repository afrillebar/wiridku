import type { ReactNode } from "react";
import { QuranFont } from "@/components/quran-font";

export default function Layout({ children }: { children: ReactNode }) {
  return <QuranFont>{children}</QuranFont>;
}
