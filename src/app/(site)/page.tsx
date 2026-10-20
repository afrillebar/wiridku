import { Dashboard, type DashboardPhase } from "@/components/dashboard";
import { getPublishedPhases } from "@/lib/content";

export default async function Home() {
  const phases: DashboardPhase[] = (await getPublishedPhases()).map((p) => ({
    slug: p.slug,
    title: p.title,
    cards: p.recitations.map((r) => ({ slug: r.slug, title: r.title, number: r.display_number })),
  }));
  return <Dashboard phases={phases} />;
}
