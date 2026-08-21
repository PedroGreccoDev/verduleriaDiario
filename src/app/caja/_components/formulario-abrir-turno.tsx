"use client";

import { useActionState } from "react";
import { accionAbrirTurno, type ResultadoAccion } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MensajeError } from "./mensaje-error";

const INICIAL: ResultadoAccion = { ok: true };

export function FormularioAbrirTurno({
  sugeridos,
  proximoSugerido,
}: {
  sugeridos: string[];
  proximoSugerido: string | null;
}) {
  const [resultado, accion, pendiente] = useActionState(accionAbrirTurno, INICIAL);

  // Los sugeridos van primero, pero los tres nombres están siempre disponibles:
  // la regla de turnos por día propone, no bloquea. Un feriado o un domingo
  // atípico se cargan sin pelear con el sistema.
  const opciones = [...sugeridos, ...["mañana", "tarde", "único"].filter((n) => !sugeridos.includes(n))];

  return (
    <form action={accion} className="space-y-4">
      <fieldset className="space-y-2" disabled={pendiente}>
        <legend className="text-sm font-medium mb-2">¿Qué turno abrís?</legend>
        <div className="flex flex-wrap gap-2">
          {opciones.map((nombre) => (
            <label
              key={nombre}
              className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:checked]:font-medium"
            >
              <input
                type="radio"
                name="nombre"
                value={nombre}
                defaultChecked={nombre === (proximoSugerido ?? sugeridos[0])}
                className="accent-primary"
              />
              <span className="capitalize">{nombre}</span>
              {!sugeridos.includes(nombre) && (
                <span className="text-xs text-muted-foreground">(inusual hoy)</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="observacion">Observación (opcional)</Label>
        <Input id="observacion" name="observacion" disabled={pendiente} />
      </div>

      <MensajeError resultado={resultado} />

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Abriendo…" : "Abrir turno"}
      </Button>
    </form>
  );
}
