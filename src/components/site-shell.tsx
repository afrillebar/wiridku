"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { InstallPrompt } from "./install-prompt";
import { track } from "@/lib/track";

// Public pages share this frame: the offline worker, page-view tracking and the install prompt.
// Navigation is hub-and-spoke: the home page links to each feature, each feature page links back home.
export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    track("view");
  }, [pathname]);

  useEffect(() => {
    // ponytail: production only, a dev-mode worker would serve stale hot-reload bundles
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const urls = performance.getEntriesByType("resource").map((e) => e.name);
        reg.active?.postMessage({ type: "cache-assets", urls });
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {children}
      <InstallPrompt />
    </>
  );
}
