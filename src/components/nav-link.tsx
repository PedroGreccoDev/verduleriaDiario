"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
  icon,
}: {
  href: string;
  children: ReactNode;
  icon: ReactNode;
}) {
  const pathname = usePathname();
  const activo = href === "/caja" ? pathname.startsWith("/caja") : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] font-medium transition-colors ${
        activo
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
