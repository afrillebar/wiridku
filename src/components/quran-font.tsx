import type { ReactNode } from "react";
import { Amiri_Quran } from "next/font/google";

// Amiri Quran draws the Uthmani marks that plain Amiri misses; loaded only on the pages that read Qur'an text.
const amiriQuran = Amiri_Quran({
  variable: "--font-quran",
  subsets: ["arabic"],
  weight: "400",
});

// contents: the wrapper adds no box of its own (a page whose parent lays its children out in a column)
export function QuranFont({ children, contents }: { children: ReactNode; contents?: boolean }) {
  return (
    <div className={amiriQuran.variable} style={contents ? { display: "contents" } : undefined}>
      {children}
    </div>
  );
}
