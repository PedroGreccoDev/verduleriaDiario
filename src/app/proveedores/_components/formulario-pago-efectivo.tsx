"use client";

import { useActionState, useState } from "react";
import { accionPagarEnEfectivo, type ResultadoAccion } from "../actions";
import {
  aEnteroEscalado,
  deEnteroEscalado,
  formatearCanonico,
  normalizarMontoTexto,
} from "@/lib/monto-texto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const INICIAL: ResultadoAccion = { ok: true };

export interface FacturaParaImputar {
  id: string;
  numero: string;
  /** Canónico, ej. "128450". */
  saldoPendiente: string;
  vencimiento: string | null;
}

/**
 * Pago a proveedor en efectivo (§4.5).
 *
 * Mismo flujo de imputación que la entrega de cheque, con una diferencia que la
 * pantalla tiene que dejar clara: acá SÍ sale plata de la Bolsa Grande. La
 * entrega de un cheque no mueve la caja porque el efectivo salió al comprarlo;
 * este pago la mueve ahora.
 *
 * El monto va aparte de las imputaciones a propósito: pagar $100.000 e imputar
 * $80.000 es válido —los $20.000 quedan como saldo a favor— pero tiene que ser
 * una decisión visible, no el resultado de una cuenta que nadie hizo. Los totales
 * se calculan en enteros, igual que en la entrega: sumar en punto flotante haría
 * que "sin imputar" mostrara $1 cuando en realidad es 0.
 */
export function FormularioPagoEfectivo({
  proveedorId,
  facturas,
  hayTurnoAbierto,
}: {
  proveedorId: string;
  facturas: FacturaParaImputar[];
  hayTurnoAbierto: boolean;
}) {
  const [resultado, accion, pendiente] = useActionState(accionPagarEnEfectivo, INICIAL);
  const [monto, setMonto] = useState("");
  const [montos, setMontos] = useState<Record<string, string>>({});

  const canonicoPago = normalizarMontoTexto(monto.trim());
  const pagoPesos = canonicoPago === null ? null : aEnteroEscalado(canonicoPago, 0);

  let imputadoPesos = 0n;
  let hayInvalido = false;

  for (const factura of facturas) {
    const texto = (montos[factura.id] ?? "").trim();
    if (texto === "") continue;

    const canonico = normalizarMontoTexto(texto);
    if (canonico === null) {
      hayInvalido = true;
      continue;
    }
    imputadoPesos += aEnteroEscalado(canonico, 0);
  }

  const sinImputar = pagoPesos === null ? null : pagoPesos - imputadoPesos;
  const superaPago = sinImputar !== null && sinImputar < 0n;

  function completarSaldo(factura: FacturaParaImputar) {
    setMontos((previos) => ({ ...previos, [factura.id]: factura.saldoPendiente }));
  }

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="proveedorId" value={proveedorId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="monto">Cuánto le pagás</Label>
          <Input
            id="monto"
            name="monto"
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
          <Label htmlFor="observacion">Observación</Label>
          <Input
            id="observacion"
            name="observacion"
            placeholder="Opcional"
            autoComplete="off"
            disabled={pendiente}
          />
        </div>
      </div>

      {facturas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tiene facturas pendientes. Si le pagás igual, todo queda como saldo a
          favor suyo y se descuenta de la próxima factura.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {facturas.map((factura) => (
            <li key={factura.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1">
                <p className="font-medium">Factura {factura.numero}</p>
                <p className="text-xs text-muted-foreground">
                  Debe {formatearCanonico(factura.saldoPendiente)}
                  {factura.vencimiento && ` · vence ${factura.vencimiento}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  name={`imputacion:${factura.id}`}
                  inputMode="numeric"
                  placeholder="0"
                  autoComplete="off"
                  disabled={pendiente}
                  className="w-40"
                  value={montos[factura.id] ?? ""}
                  onChange={(e) =>
                    setMontos((previos) => ({ ...previos, [factura.id]: e.target.value }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendiente}
                  onClick={() => completarSaldo(factura)}
                >
                  Todo
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
        <Fila
          etiqueta="Sale de la caja"
          valor={canonicoPago === null ? "—" : formatearCanonico(canonicoPago)}
        />
        <Fila
          etiqueta="Imputado a facturas"
          valor={formatearCanonico(deEnteroEscalado(imputadoPesos, 0))}
        />
        <div className="border-t pt-2">
          {superaPago && sinImputar !== null ? (
            <p className="text-sm text-destructive">
              Estás imputando {formatearCanonico(deEnteroEscalado(-sinImputar, 0))} más
              de lo que pagás. No se puede.
            </p>
          ) : sinImputar === null ? (
            <p className="text-sm text-muted-foreground">
              Escribí cuánto le pagás para ver cómo queda.
            </p>
          ) : sinImputar === 0n ? (
            <p className="text-sm text-muted-foreground">
              El pago cubre exactamente las facturas imputadas.
            </p>
          ) : (
            <p className="text-sm">
              Quedan{" "}
              <strong className="tabular-nums">
                {formatearCanonico(deEnteroEscalado(sinImputar, 0))}
              </strong>{" "}
              como saldo a favor del proveedor, que se descuentan solos de su próxima
              factura.
            </p>
          )}
        </div>
      </div>

      {hayInvalido && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>Hay un monto mal escrito.</AlertDescription>
        </Alert>
      )}

      {!resultado.ok && resultado.mensaje && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border-l-2 border-muted-foreground/30 pl-3 text-xs text-muted-foreground">
        {hayTurnoAbierto
          ? "Este pago es un egreso de la Bolsa Grande y queda en el turno abierto."
          : "No hay ningún turno abierto, así que el egreso queda registrado fuera de turno."}
      </div>

      <Button type="submit" disabled={pendiente || superaPago || hayInvalido}>
        {pendiente ? "Registrando…" : "Registrar pago"}
      </Button>
    </form>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}
