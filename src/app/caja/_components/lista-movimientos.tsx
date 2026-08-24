"use client";

import { useId, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CANTIDAD_INICIAL = 4;

export interface MovimientoParaLista {
  id: string;
  hora: string;
  tipo: "ingreso" | "egreso";
  categoria: string;
  monto: string;
  observacion: string | null;
  autor: string | null;
}

export function ListaMovimientos({
  movimientos,
}: {
  movimientos: MovimientoParaLista[];
}) {
  const [expandida, setExpandida] = useState(false);
  const contenidoId = useId();
  const visibles = expandida ? movimientos : movimientos.slice(0, CANTIDAD_INICIAL);
  const restantes = movimientos.length - CANTIDAD_INICIAL;

  return (
    <>
      <div id={contenidoId}>
        <ul className="space-y-3 sm:hidden">
          {visibles.map((movimiento) => (
            <li
              key={movimiento.id}
              className="rounded-xl border border-border bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{movimiento.categoria}</p>
                  {movimiento.observacion && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {movimiento.observacion}
                    </p>
                  )}
                </div>
                <p
                  className={`font-heading text-lg font-bold tabular-nums ${
                    movimiento.tipo === "egreso" ? "text-destructive" : ""
                  }`}
                >
                  {movimiento.tipo === "egreso" ? "−" : "+"}
                  {movimiento.monto}
                </p>
              </div>
              <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                {movimiento.hora} · {movimiento.autor ?? "Sin autor"}
              </p>
            </li>
          ))}
        </ul>

        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Hora</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Cargó</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((movimiento) => (
                <TableRow key={movimiento.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {movimiento.hora}
                  </TableCell>
                  <TableCell>
                    <span>{movimiento.categoria}</span>
                    {movimiento.observacion && (
                      <span className="block text-xs text-muted-foreground">
                        {movimiento.observacion}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {movimiento.autor ?? (
                      <span title="Cargado antes de que hubiera usuarios">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      movimiento.tipo === "egreso" ? "text-destructive" : ""
                    }`}
                  >
                    {movimiento.tipo === "egreso" ? "−" : "+"}
                    {movimiento.monto}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {restantes > 0 && (
        <div className="mt-4 border-t border-border/70 pt-3">
          <button
            type="button"
            aria-expanded={expandida}
            aria-controls={contenidoId}
            onClick={() => setExpandida((valor) => !valor)}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {expandida
              ? "Mostrar solo los recientes"
              : `Ver ${restantes} movimiento${restantes === 1 ? "" : "s"} anterior${restantes === 1 ? "" : "es"}`}
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
              className={`size-4 transition-transform ${expandida ? "rotate-180" : ""}`}
            >
              <path d="m6 8 4 4 4-4" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
