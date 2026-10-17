import type { Metadata } from "next";
import { ThemeBoot } from "@/components/admin/theme-switch";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin — Wiridku",
  robots: { index: false, follow: false },
};

const themeBoot = `(function(){try{if(localStorage.getItem("wiridku-admin-theme")==="malam")document.body.dataset.adminTheme="malam"}catch(e){}})()`;

export default function AdminRootLayout({ children }: LayoutProps<"/putrazea">) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      <ThemeBoot />
      <div className="admin">{children}</div>
    </>
  );
}
