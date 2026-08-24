"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";

export function Sidebar({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const cerrarYDevolverFoco = useCallback(() => {
    setAbierto(false);
    requestAnimationFrame(() => botonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!abierto) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const enfocables = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    enfocables?.[0]?.focus();

    function manejarTeclado(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        cerrarYDevolverFoco();
        return;
      }

      if (evento.key !== "Tab" || !enfocables?.length) return;

      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", manejarTeclado);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", manejarTeclado);
    };
  }, [abierto, cerrarYDevolverFoco]);

  return (
    <>
      {/* Barra superior: solo se ve en pantallas chicas, reemplaza a la sidebar. */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-5 text-sidebar-foreground shadow-md md:hidden">
        <Logo className="scale-90 origin-left" />
        <button
          ref={botonRef}
          type="button"
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
          aria-controls="navegacion-movil"
          onClick={() => (abierto ? cerrarYDevolverFoco() : setAbierto(true))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-sidebar-accent/60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            {abierto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {abierto && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
            onClick={cerrarYDevolverFoco}
            aria-hidden="true"
          />
          <aside
            ref={panelRef}
            id="navegacion-movil"
            role="dialog"
            aria-modal="true"
            aria-label="Navegación principal"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-2xl md:hidden"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <Logo />
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={cerrarYDevolverFoco}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-sidebar-accent"
              >
                <span aria-hidden="true" className="text-2xl leading-none">×</span>
              </button>
            </div>
            <div onClick={() => setAbierto(false)} className="contents">
              {children}
            </div>
          </aside>
        </>
      )}

      <aside
        className="hidden w-68 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-[12px_0_36px_rgba(20,42,34,0.08)] md:flex lg:w-72"
      >
        <div className="px-2 pt-2 pb-8">
          <Logo />
        </div>
        {children}
      </aside>
    </>
  );
}
