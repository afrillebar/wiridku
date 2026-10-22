import { Dashboard, type DashboardPhase } from "@/components/dashboard";
import { getHiddenMenus, getPublishedPhases } from "@/lib/content";

export default async function Home() {
  const [published, hidden] = await Promise.all([getPublishedPhases(), getHiddenMenus()]);
  const phases: DashboardPhase[] = published.map((p) => ({
    slug: p.slug,
    title: p.title,
    cards: p.recitations.map((r) => ({ slug: r.slug, title: r.title, number: r.display_number })),
  }));
  return <Dashboard phases={phases} hidden={hidden} />;
}
