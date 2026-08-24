"use client";

import { useId, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function NavGroup({
  etiqueta,
  icon,
  prefijo,
  children,
}: {
  etiqueta: string;
  icon: ReactNode;
  prefijo: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activo = pathname.startsWith(prefijo);
  const [abierto, setAbierto] = useState(activo);
  const contenidoId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={contenidoId}
        onClick={() => setAbierto((valor) => !valor)}
        className={`flex min-h-11 w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors ${
          activo
            ? "bg-white/10 text-white"
            : "text-white/68 hover:bg-white/8 hover:text-white"
        }`}
      >
        {icon}
        <span className="flex-1">{etiqueta}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`size-4 transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>

      {abierto && (
        <div
          id={contenidoId}
          className="ml-[1.35rem] mt-1 border-l border-white/14 pl-2"
        >
          {children}
        </div>
      )}
    </div>
  );
}
