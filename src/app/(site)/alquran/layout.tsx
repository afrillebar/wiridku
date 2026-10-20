import type { ReactNode } from "react";
import { Amiri_Quran } from "next/font/google";

// Amiri Quran draws the Uthmani marks that plain Amiri misses; loaded only on the Al-Qur'an pages.
const amiriQuran = Amiri_Quran({
  variable: "--font-quran",
  subsets: ["arabic"],
  weight: "400",
});

export default function QuranLayout({ children }: { children: ReactNode }) {
  return <div className={amiriQuran.variable}>{children}</div>;
}
