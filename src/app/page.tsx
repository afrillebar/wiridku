import { WiridApp } from "@/components/wirid-app";
import { getPublishedPhases } from "@/lib/content";

export default async function Home() {
  return <WiridApp phases={await getPublishedPhases()} />;
}
