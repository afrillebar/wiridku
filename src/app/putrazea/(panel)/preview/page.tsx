import { ReadingIndex } from "@/components/reading";
import { QuranFont } from "@/components/quran-font";
import { wiridReadings } from "@/lib/wirid-readings";
import { getPreviewPhases } from "./data";

export default async function PreviewPage() {
  const readings = wiridReadings(await getPreviewPhases());
  return (
    <div className="preview">
      <p className="msg warn preview-banner">Pratinjau: menampilkan semua fase dan bacaan termasuk draft, apa adanya seperti tampilan publik. Centang di sini tidak disimpan.</p>
      <QuranFont>
        <ReadingIndex module="wirid" readings={readings} base="/putrazea/preview" preview />
      </QuranFont>
    </div>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = "force-disabled";
