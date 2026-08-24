"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
  icon,
  anidado = false,
}: {
  href: string;
  children: ReactNode;
  icon: ReactNode;
  anidado?: boolean;
}) {
  const pathname = usePathname();
  const activo = href === "/caja" ? pathname.startsWith("/caja") : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`group relative flex items-center gap-3.5 font-medium transition-all ${
        anidado ? "min-h-10 rounded-lg px-3 py-2 text-[13px]" : "min-h-11 rounded-xl px-3.5 py-2.5 text-[14px]"
      } ${
        activo
          ? "bg-sidebar-primary text-[#1f2c25] shadow-[0_8px_20px_rgba(16,30,23,0.2)]"
          : "text-white/68 hover:bg-white/8 hover:text-white"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
