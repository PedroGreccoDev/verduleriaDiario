"use client";

import { useActionState, useState } from "react";
import { accionCrearFactura, type ResultadoAccion } from "../actions";
import { aEnteroEscalado, formatearCanonico, normalizarMontoTexto } from "@/lib/monto-texto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";

const INICIAL: ResultadoAccion = { ok: true };

/**
 * Alta de factura de proveedor (§3.3).
 *
 * Lo único que esta pantalla tiene que explicar es el saldo a favor: si al
 * proveedor se le entregó de más, la factura nueva nace parcial o directamente
 * pagada, sin que exista ningún pago asociado a ella. Visto sin aviso previo
 * parece un error del sistema —"cargué una factura y aparece paga"— así que el
 * descuento se anticipa mientras el operador tipea el monto.
 */
export function FormularioFactura({
  proveedorId,
  creditoDisponible,
  hoy,
}: {
  proveedorId: string;
  /** Canónico y sin signo, ej. "30000". "0" si no hay saldo a favor. */
  creditoDisponible: string;
  /** "2026-08-14", calculado en el servidor para no romper la hidratación. */
  hoy: string;
}) {
  const [resultado, accion, pendiente] = useActionState(accionCrearFactura, INICIAL);
  const [monto, setMonto] = useState("");

  const creditoPesos = aEnteroEscalado(creditoDisponible, 0);
  const canonico = normalizarMontoTexto(monto.trim());
  const montoPesos = canonico === null ? null : aEnteroEscalado(canonico, 0);
  const hayCredito = creditoPesos > 0n;

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="proveedorId" value={proveedorId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="numero">Número</Label>
          <Input
            id="numero"
            name="numero"
            placeholder="A-0001-00012345"
            autoComplete="off"
            required
            disabled={pendiente}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="montoTotal">Monto</Label>
          <Input
            id="montoTotal"
            name="montoTotal"
            inputMode="numeric"
            placeholder="128.450"
            autoComplete="off"
            required
            disabled={pendiente}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha</Label>
          <DatePicker id="fecha" name="fecha" defaultValue={hoy} disabled={pendiente} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fechaVencimiento">Vencimiento</Label>
          <DatePicker id="fechaVencimiento" name="fechaVencimiento" disabled={pendiente} />
          <p className="text-xs text-muted-foreground">
            Opcional. Sin fecha, la factura no aparece en los avisos de vencimiento.
          </p>
        </div>
      </div>

      {hayCredito && (
        <div className="rounded-md border-l-2 border-muted-foreground/30 pl-3 text-xs text-muted-foreground">
          {montoPesos === null ? (
            <>
              Hay {formatearCanonico(creditoDisponible)} a favor con este proveedor,
              que se descuentan solos de esta factura.
            </>
          ) : montoPesos <= creditoPesos ? (
            <>
              Esta factura nace <strong>pagada</strong>: el saldo a favor de{" "}
              {formatearCanonico(creditoDisponible)} la cubre entera. No hace falta
              registrar ningún pago.
            </>
          ) : (
            <>
              Nace <strong>parcial</strong>: quedan por pagar{" "}
              {formatearCanonico((montoPesos - creditoPesos).toString())} después de
              descontar el saldo a favor.
            </>
          )}
        </div>
      )}

      {!resultado.ok && resultado.mensaje && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Cargando…" : "Cargar factura"}
      </Button>
    </form>
  );
}
