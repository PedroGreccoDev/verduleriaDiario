"use client";

import * as React from "react";
import { es } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const FORMATO_VISIBLE = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function aFechaLocal(valor: string): Date | undefined {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return undefined;
  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
}

function aTextoISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/**
 * Reemplazo de `<input type="date">`: el calendario nativo del navegador no se
 * puede tematizar, así que acá se arma con Popover + Calendar (shadcn) y un
 * input oculto que manda el valor "YYYY-MM-DD" de siempre.
 */
export function DatePicker({
  id,
  name,
  defaultValue,
  disabled,
  placeholder = "Elegí una fecha",
  className,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [valor, setValor] = React.useState(defaultValue ?? "");
  const [abierto, setAbierto] = React.useState(false);
  const seleccionada = aFechaLocal(valor);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <input type="hidden" name={name} value={valor} />
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-2 font-normal",
            !seleccionada && "text-muted-foreground",
            className
          )}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
          >
            <rect x="3" y="4.5" width="18" height="16" rx="2" />
            <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
          </svg>
          {seleccionada ? FORMATO_VISIBLE.format(seleccionada) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={es}
          selected={seleccionada}
          defaultMonth={seleccionada}
          onSelect={(fecha) => {
            setValor(fecha ? aTextoISO(fecha) : "");
            setAbierto(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
