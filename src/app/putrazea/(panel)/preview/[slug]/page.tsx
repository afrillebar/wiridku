import { notFound } from "next/navigation";
import { ReadingReader } from "@/components/reading";
import { QuranFont } from "@/components/quran-font";
import { getListenBackgrounds } from "@/lib/content";
import { wiridReadings } from "@/lib/wirid-readings";
import { getPreviewPhases } from "../data";

export default async function PreviewReadingPage(props: PageProps<"/putrazea/preview/[slug]">) {
  const { slug } = await props.params;
  const [phases, backgrounds] = await Promise.all([getPreviewPhases(), getListenBackgrounds()]);
  const readings = wiridReadings(phases);
  if (!readings.some((r) => r.slug === slug)) notFound();
  return (
    <div className="preview">
      <QuranFont>
        <ReadingReader module="wirid" readings={readings} slug={slug} backgrounds={backgrounds} base="/putrazea/preview" preview />
      </QuranFont>
    </div>
  );
}

export const instant = false;
export const prefetch = "force-disabled";
