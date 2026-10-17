import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin — Wiridku",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/putrazea">) {
  return <div className="admin">{children}</div>;
}
