import { Suspense } from "react";
import Link from "next/link";
import { signOut } from "@/actions/auth";
import { requireStaff } from "@/lib/auth";
import { Nav, type NavItem } from "@/components/admin/nav";

// ponytail: header and page content are siblings, so they fetch in parallel instead of the page waiting for the header's session lookup
export default function PanelLayout({ children }: LayoutProps<"/putrazea">) {
  return (
    <>
      <Suspense fallback={<header className="admin-top admin-top-skeleton" aria-hidden="true" />}>
        <Header />
      </Suspense>
      <main className="admin-main">{children}</main>
    </>
  );
}

async function Header() {
  const staff = await requireStaff();
  const items: NavItem[] = [
    { href: "/putrazea", label: "Dashboard" },
    { href: "/putrazea/phases", label: "Fase" },
    { href: "/putrazea/recitations", label: "Bacaan" },
    { href: "/putrazea/preview", label: "Pratinjau" },
    ...(staff.role === "admin"
      ? [
          { href: "/putrazea/traffic", label: "Trafik" },
          { href: "/putrazea/users", label: "Pengguna" },
          { href: "/putrazea/settings", label: "Pengaturan" },
        ]
      : []),
    { href: "/putrazea/history", label: "Riwayat" },
    { href: "/putrazea/akun", label: "Akun" },
  ];

  return (
    <header className="admin-top">
      <div className="admin-top-inner">
        <Link prefetch={false} href="/putrazea" className="admin-brand">
          Wiridku <span>admin</span>
        </Link>
        <div className="admin-user">
          <span>
            {staff.email} · {staff.role}
          </span>
          <Link prefetch={false} href="/" className="btn small" target="_blank">
            Lihat situs
          </Link>
          <form action={signOut}>
            <button type="submit" className="btn small">
              Keluar
            </button>
          </form>
        </div>
      </div>
      <Nav items={items} />
    </header>
  );
}

// ponytail: admin reads the session on every request, so it opts out of instant-navigation validation
export const instant = false;
export const prefetch = 'force-disabled';
