"use client";

import { useActionState, useState } from "react";
import { accionRevertirEntrega, type ResultadoAccion } from "../actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const INICIAL: ResultadoAccion = { ok: true };

/**
 * Deshace una entrega que se cargó mal (§4.3).
 *
 * Pide confirmación en dos pasos, con el detalle de lo que va a volver a deberse
 * escrito en el propio botón. Revertir mueve saldos de facturas y de proveedores;
 * un click accidental en una lista de entregas parecidas sería caro de rastrear
 * después, porque nada en la pantalla mostraría que pasó.
 *
 * La confirmación aclara que esto NO es para un cheque que rebotó. Es el error
 * caro: revertir un rebote reabre una deuda que la financiera ya pagó, y la
 * verdulería terminaría reclamándole al proveedor plata que no debe (§4.4).
 */
export function BotonRevertirEntrega({
  chequeId,
  descripcion,
}: {
  chequeId: string;
  /** Qué vuelve a deberse, en una línea. Ej: "$ 80.000 a la factura A-001". */
  descripcion: string;
}) {
  const [resultado, accion, pendiente] = useActionState(accionRevertirEntrega, INICIAL);
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => setConfirmando(true)}>
          Revertir entrega
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
      <p className="text-xs text-muted-foreground">
        Vuelve a deberse {descripcion}. El cheque queda otra vez en cartera.
      </p>
      <p className="text-xs text-muted-foreground">
        Usalo solo si cargaste mal la entrega.{" "}
        <strong className="font-medium text-foreground">
          Si el cheque rebotó, no reviertas
        </strong>
        : lo levanta quien te lo vendió y la deuda con el proveedor queda saldada.
      </p>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pendiente}
          onClick={() => setConfirmando(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="destructive" size="sm" disabled={pendiente}>
          {pendiente ? "Revirtiendo…" : "Sí, revertir"}
        </Button>
      </div>
    </form>
  );
}
