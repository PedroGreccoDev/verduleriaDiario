"use client";

import { useActionState, useState } from "react";
import { accionCobrar, accionFiar, type ResultadoAccion } from "../actions";
import { aEnteroEscalado, formatearCanonico, normalizarMontoTexto } from "@/lib/monto-texto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const INICIAL: ResultadoAccion = { ok: true };

/**
 * Fiar y cobrar son el mismo formulario con el signo cambiado, así que es un solo
 * componente: dos copias se irían separando con cada retoque y el operador vería
 * dos pantallas distintas para dos gestos gemelos.
 *
 * Lo que sí cambia entre los dos —y por eso está escrito en la pantalla— es la
 * caja: fiar no la mueve, porque salió mercadería y no plata; cobrar sí, porque
 * entra efectivo a la Bolsa Grande. Confundirlos es lo que descuadra un arqueo.
 */
export function FormularioMovimiento({
  clienteId,
  modo,
  saldoActual,
  hayTurnoAbierto,
}: {
  clienteId: string;
  modo: "fiar" | "cobrar";
  /** Canónico y con signo, ej. "12000" o "-5000". */
  saldoActual: string;
  hayTurnoAbierto: boolean;
}) {
  const fiando = modo === "fiar";
  const [resultado, accion, pendiente] = useActionState(
    fiando ? accionFiar : accionCobrar,
    INICIAL,
  );
  const [monto, setMonto] = useState("");

  const canonico = normalizarMontoTexto(monto.trim());
  const saldoPesos = aEnteroEscalado(saldoActual, 0);
  const montoPesos = canonico === null ? null : aEnteroEscalado(canonico, 0);

  const saldoResultante =
    montoPesos === null ? null : fiando ? saldoPesos + montoPesos : saldoPesos - montoPesos;

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="clienteId" value={clienteId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`monto-${modo}`}>{fiando ? "Cuánto se lleva" : "Cuánto paga"}</Label>
          <Input
            id={`monto-${modo}`}
            name="monto"
            inputMode="numeric"
            placeholder="12.000"
            autoComplete="off"
            required
            disabled={pendiente}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`observacion-${modo}`}>Observación</Label>
          <Input
            id={`observacion-${modo}`}
            name="observacion"
            placeholder={fiando ? "Qué se llevó" : "Opcional"}
            autoComplete="off"
            disabled={pendiente}
          />
        </div>
      </div>

      {saldoResultante !== null && (
        <p className="text-sm">
          {saldoResultante > 0n ? (
            <>
              Le queda una deuda de{" "}
              <strong className="tabular-nums">
                {formatearCanonico(saldoResultante.toString())}
              </strong>
              .
            </>
          ) : saldoResultante === 0n ? (
            <>Queda al día, sin deuda.</>
          ) : (
            <>
              Paga de más:{" "}
              <strong className="tabular-nums">
                {formatearCanonico((-saldoResultante).toString())}
              </strong>{" "}
              le quedan a favor y se descuentan de lo próximo que se lleve.
            </>
          )}
        </p>
      )}

      {!resultado.ok && resultado.mensaje && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border-l-2 border-muted-foreground/30 pl-3 text-xs text-muted-foreground">
        {fiando
          ? "No mueve la caja: se fue mercadería, no plata. El efectivo entra recién cuando pague."
          : hayTurnoAbierto
            ? "Entra plata a la Bolsa Grande y queda en el turno abierto."
            : "No hay ningún turno abierto, así que el ingreso queda registrado fuera de turno."}
      </div>

      <Button type="submit" disabled={pendiente}>
        {pendiente
          ? fiando
            ? "Anotando…"
            : "Registrando…"
          : fiando
            ? "Anotar fiado"
            : "Registrar pago"}
      </Button>
    </form>
  );
}
