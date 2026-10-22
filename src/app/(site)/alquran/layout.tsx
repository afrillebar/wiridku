import type { ReactNode } from "react";
import { QuranFont } from "@/components/quran-font";

export default function QuranLayout({ children }: { children: ReactNode }) {
  return <QuranFont>{children}</QuranFont>;
}
