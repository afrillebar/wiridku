import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuranReader } from "@/components/quran";
import { getListenBackgrounds } from "@/lib/content";
import { getQaris, getSurahs, getVerses, isSurahId } from "@/lib/quran";
import { SURAH_COUNT } from "@/lib/quran-types";

// every surah is built ahead, so reading works from the offline cache once a page has been opened
export function generateStaticParams() {
  return Array.from({ length: SURAH_COUNT }, (_, i) => ({ surah: String(i + 1) }));
}

export async function generateMetadata(props: PageProps<"/alquran/[surah]">): Promise<Metadata> {
  const id = Number((await props.params).surah);
  const surah = isSurahId(id) ? (await getSurahs())[id - 1] : null;
  return { title: surah ? `${surah.name} — Al-Qur'an — Wiridku` : "Al-Qur'an — Wiridku" };
}

export default async function SurahPage(props: PageProps<"/alquran/[surah]">) {
  const id = Number((await props.params).surah);
  if (!isSurahId(id)) notFound();
  const [surahs, verses, qaris, backgrounds] = await Promise.all([getSurahs(), getVerses(id), getQaris(), getListenBackgrounds()]);
  return <QuranReader surah={surahs[id - 1]} surahs={surahs} verses={verses} qaris={qaris} backgrounds={backgrounds} />;
}
