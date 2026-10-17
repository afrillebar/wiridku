import type { Metadata, Viewport } from "next";
import { Amiri, Fraunces, Karla } from "next/font/google";
import "./globals.css";
import "./wirid.css";

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

export const viewport: Viewport = {
  themeColor: "#5C7A6A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${fraunces.variable} ${karla.variable} ${amiri.variable}`}>
      <body>{children}</body>
    </html>
  );
}
