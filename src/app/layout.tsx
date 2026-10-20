import type { Metadata, Viewport } from "next";
import { Amiri, Fraunces, Karla } from "next/font/google";
import { getSiteTheme } from "@/lib/content";
import { SITE_THEMES, VISITOR_THEME_SCRIPT } from "@/lib/site-theme";
import "./globals.css";
import "./wirid.css";
import "./site-theme.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Wiridku — Wirid & Doa Ba'da Salat",
  description: "Panduan wirid dan doa setelah salat fardhu — runtut, mudah dibaca, dan konsisten setiap hari.",
  applicationName: "Wiridku",
  appleWebApp: { capable: true, title: "Wiridku", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await getSiteTheme();
  return {
    themeColor: SITE_THEMES.find((item) => item.id === theme)?.color ?? "#5C7A6A",
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getSiteTheme();
  return (
    // ponytail: the head script may swap data-site-theme for the visitor's own choice before React hydrates
    <html lang="id" data-site-theme={theme} className={`${fraunces.variable} ${karla.variable} ${amiri.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: VISITOR_THEME_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
