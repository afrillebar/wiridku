import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Wiridku — Wirid & Doa Ba'da Salat",
    short_name: "Wiridku",
    description: "Panduan wirid dan doa setelah salat fardhu — runtut, mudah dibaca, dan konsisten setiap hari.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF3E6",
    theme_color: "#5C7A6A",
    lang: "id",
    dir: "ltr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
