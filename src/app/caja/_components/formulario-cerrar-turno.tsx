"use client";

import { useActionState } from "react";
import { accionCerrarTurno, type ResultadoAccion } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MensajeError } from "./mensaje-error";

const INICIAL: ResultadoAccion = { ok: true };

export function FormularioCerrarTurno({ turnoId }: { turnoId: string }) {
  const [resultado, accion, pendiente] = useActionState(accionCerrarTurno, INICIAL);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="turnoId" value={turnoId} />

      <div className="space-y-2">
        <Label htmlFor="monto-cierre">Efectivo que queda en la registradora</Label>
        <Input
          id="monto-cierre"
          name="monto"
          inputMode="numeric"
          placeholder="Dejalo vacío si ya retiraste todo"
          autoComplete="off"
          disabled={pendiente}
        />
        <p className="text-xs text-muted-foreground">
          Se registra como un retiro más antes de cerrar. Si ya lo retiraste durante
          el turno, dejá el campo vacío.
        </p>
      </div>

      <MensajeError resultado={resultado} />

      <Button type="submit" disabled={pendiente} variant="destructive">
        {pendiente ? "Cerrando…" : "Cerrar turno"}
      </Button>
    </form>
  );
}
