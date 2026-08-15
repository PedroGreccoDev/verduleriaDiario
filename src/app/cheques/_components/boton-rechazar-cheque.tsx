"use client";

import { useActionState, useState } from "react";
import { accionRechazarCheque, type ResultadoAccion } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

const INICIAL: ResultadoAccion = { ok: true };

/**
 * Registra que un cheque entregado rebotó (§4.4).
 *
 * No mueve un solo peso, y eso es lo que hay que explicar en la pantalla: quien
 * vendió el cheque lo levanta pagándole directo al proveedor, así que la factura
 * sigue pagada y el ahorro sigue contando. Sin esa aclaración, el operador podría
 * pensar que el sistema se olvidó de reabrir la deuda y "arreglarlo" a mano.
 *
 * El motivo es obligatorio porque es lo único que después explica un histórico de
 * rechazos por librador: "sin fondos" y "firma no coincide" no son el mismo
 * problema ni se le reclaman a la misma persona.
 */
export function BotonRechazarCheque({ chequeId }: { chequeId: string }) {
  const [resultado, accion, pendiente] = useActionState(accionRechazarCheque, INICIAL);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => setAbierto(true)}>
          Rebotó
        </Button>
        {!resultado.ok && (
          <Alert variant="destructive">
            <AlertDescription>{resultado.mensaje}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="chequeId" value={chequeId} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Input
          name="motivo"
          placeholder="Motivo: sin fondos, firma…"
          autoComplete="off"
          required
          disabled={pendiente}
          className="w-56"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pendiente}
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pendiente}>
          {pendiente ? "Registrando…" : "Registrar rechazo"}
        </Button>
      </div>
      <p className="text-right text-xs text-muted-foreground">
        No cambia ningún saldo: lo levanta quien te vendió el cheque y la deuda con
        el proveedor queda saldada.
      </p>
      {!resultado.ok && (
        <Alert variant="destructive">
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
