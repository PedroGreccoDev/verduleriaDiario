"use client";

import { useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export function Sidebar({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      {/* Barra superior: solo se ve en pantallas chicas, reemplaza a la sidebar. */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <Logo className="scale-90 origin-left" />
        <button
          type="button"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-sidebar-accent/60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            {abierto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {abierto && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setAbierto(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground transition-transform duration-200 md:static md:z-auto md:translate-x-0",
          abierto ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="hidden px-2 pt-1.5 pb-6 md:block">
          <Logo />
        </div>
        <div onClick={() => setAbierto(false)} className="contents">
          {children}
        </div>
      </aside>
    </>
  );
}
