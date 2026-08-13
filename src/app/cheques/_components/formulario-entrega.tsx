"use client";

import { useActionState, useState } from "react";
import { accionEntregarCheque, type ResultadoAccion } from "../actions";
import {
  aEnteroEscalado,
  deEnteroEscalado,
  formatearCanonico,
  normalizarMontoTexto,
} from "@/lib/monto-texto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

const INICIAL: ResultadoAccion = { ok: true };

export interface FacturaParaImputar {
  id: string;
  numero: string;
  saldoPendiente: string;
  vencimiento: string | null;
}

/**
 * Imputación de un cheque a varias facturas (§4.3).
 *
 * El punto de esta pantalla es que el operador VEA la consecuencia antes de
 * confirmar. Imputar menos que el nominal no es un error —el excedente queda como
 * saldo a favor del proveedor— pero tiene que ser una decisión, no una sorpresa.
 * Por eso el total imputado y el remanente se recalculan mientras tipea.
 *
 * Los totales van en enteros (pesos), igual que el cálculo del cheque: sumar con
 * punto flotante haría que "lo que falta imputar" mostrara $1 cuando en realidad
 * es 0.
 */
export function FormularioEntrega({
  chequeId,
  proveedorId,
  nominal,
  facturas,
}: {
  chequeId: string;
  proveedorId: string;
  /** Canónico, ej. "1200000". */
  nominal: string;
  facturas: FacturaParaImputar[];
}) {
  const [resultado, accion, pendiente] = useActionState(accionEntregarCheque, INICIAL);
  const [montos, setMontos] = useState<Record<string, string>>({});

  const nominalPesos = aEnteroEscalado(nominal, 0);

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

  const remanentePesos = nominalPesos - imputadoPesos;
  const superaNominal = remanentePesos < 0n;

  function completarSaldo(factura: FacturaParaImputar) {
    setMontos((previos) => ({ ...previos, [factura.id]: factura.saldoPendiente }));
  }

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="chequeId" value={chequeId} />
      <input type="hidden" name="proveedorId" value={proveedorId} />

      {facturas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este proveedor no tiene facturas pendientes. Si entregás el cheque igual,
          el nominal completo queda como saldo a favor suyo.
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
        <Fila etiqueta="Nominal del cheque" valor={formatearCanonico(nominal)} />
        <Fila
          etiqueta="Imputado a facturas"
          valor={formatearCanonico(deEnteroEscalado(imputadoPesos, 0))}
        />
        <div className="border-t pt-2">
          {superaNominal ? (
            <p className="text-sm text-destructive">
              Estás imputando{" "}
              {formatearCanonico(deEnteroEscalado(-remanentePesos, 0))} más que el
              valor del cheque. No se puede.
            </p>
          ) : remanentePesos === 0n ? (
            <p className="text-sm text-muted-foreground">
              El cheque cubre exactamente las facturas imputadas.
            </p>
          ) : (
            <p className="text-sm">
              Quedan{" "}
              <strong className="tabular-nums">
                {formatearCanonico(deEnteroEscalado(remanentePesos, 0))}
              </strong>{" "}
              como saldo a favor del proveedor, que se descuentan solos de su
              próxima factura.
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
        Entregar el cheque no mueve la caja: la plata salió cuando lo compraste. Lo
        que sí pasa es que se cuenta el ahorro.
      </div>

      <Button type="submit" disabled={pendiente || superaNominal || hayInvalido}>
        {pendiente ? "Entregando…" : "Entregar cheque"}
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
