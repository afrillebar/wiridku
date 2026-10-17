"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export type NavItem = { href: string; label: string };

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    // ponytail: on phones the menu is one scrollable row, so keep the current page's pill visible
    const el = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && nav.current) nav.current.scrollLeft = Math.max(0, el.offsetLeft - nav.current.clientWidth / 2 + el.clientWidth / 2);
  }, [pathname]);
  return (
    <nav ref={nav} className="admin-nav" aria-label="Menu admin">
      {items.map((it) => {
        const active = it.href === "/putrazea" ? pathname === "/putrazea" : pathname.startsWith(it.href);
        return (
          <Link prefetch={false} key={it.href} href={it.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
