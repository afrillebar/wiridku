import type { Metadata, Viewport } from "next";
import { Amiri, Atkinson_Hyperlegible, Fraunces, Karla, Lexend, Noto_Naskh_Arabic, Noto_Serif, Scheherazade_New } from "next/font/google";
import { getSiteTheme } from "@/lib/content";
import { FONT_SCRIPT } from "@/lib/fonts";
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

// ponytail: the typefaces a visitor can choose in Pengaturan; not preloaded, so a page downloads one only when it is chosen
const naskh = Noto_Naskh_Arabic({ variable: "--font-naskh", subsets: ["arabic"], weight: ["400", "700"], preload: false });
const scheherazade = Scheherazade_New({ variable: "--font-scheherazade", subsets: ["arabic"], weight: ["400", "700"], preload: false });
const atkinson = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400", "700"], preload: false });
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"], preload: false });
const notoSerif = Noto_Serif({ variable: "--font-noto-serif", subsets: ["latin"], weight: ["400", "700"], preload: false });

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
    <html lang="id" data-site-theme={theme} className={`${fraunces.variable} ${karla.variable} ${amiri.variable} ${naskh.variable} ${scheherazade.variable} ${atkinson.variable} ${lexend.variable} ${notoSerif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: VISITOR_THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: FONT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
