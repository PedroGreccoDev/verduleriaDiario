"use client";

import { useActionState, useRef } from "react";
import { accionRegistrarRetiro, type ResultadoAccion } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MensajeError } from "./mensaje-error";

const INICIAL: ResultadoAccion = { ok: true };

export function FormularioRetiro({ turnoId }: { turnoId: string }) {
  const [resultado, accion, pendiente] = useActionState(accionRegistrarRetiro, INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formulario}
      action={async (datos) => {
        await accion(datos);
        // Se limpia siempre, incluso si falló: si el monto era inválido, dejarlo
        // en el campo invita a apretar enviar de nuevo sin corregirlo.
        formulario.current?.reset();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="turnoId" value={turnoId} />

      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div className="space-y-2">
          <Label htmlFor="monto">Monto retirado</Label>
          <Input
            id="monto"
            name="monto"
            inputMode="decimal"
            placeholder="45.000,50"
            autoComplete="off"
            required
            disabled={pendiente}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="observacion-retiro">Observación (opcional)</Label>
          <Input
            id="observacion-retiro"
            name="observacion"
            placeholder="Retiro parcial por seguridad"
            disabled={pendiente}
          />
        </div>
      </div>

      <MensajeError resultado={resultado} />

      <Button type="submit" disabled={pendiente} variant="secondary">
        {pendiente ? "Registrando…" : "Registrar retiro"}
      </Button>
    </form>
  );
}
