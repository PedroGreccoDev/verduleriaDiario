"use client";

import { useActionState, useState } from "react";
import { accionComprarCheque, type ResultadoAccion } from "../actions";
import { previsualizarDesdeTexto } from "@/domain/cheques/calculo-puro";
import { formatearCanonico } from "@/lib/monto-texto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const INICIAL: ResultadoAccion = { ok: true };

export function FormularioCompra({
  vendedores,
}: {
  vendedores: { id: string; nombre: string }[];
}) {
  const [resultado, accion, pendiente] = useActionState(accionComprarCheque, INICIAL);
  const [nominal, setNominal] = useState("");
  const [porcentaje, setPorcentaje] = useState("");

  // §4.2 exige mostrar el monto pagado antes de confirmar. Se calcula con la
  // MISMA función que usa el servidor al guardar (`calculo-puro`), así que lo que
  // se ve acá es exactamente lo que se va a guardar, hasta el centavo.
  const vista = previsualizarDesdeTexto(nominal, porcentaje);

  return (
    <form action={accion} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="vendedorChequeId">¿A quién se lo comprás?</Label>
        <select
          id="vendedorChequeId"
          name="vendedorChequeId"
          required
          disabled={pendiente}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Elegí un vendedor
          </option>
          {vendedores.map((vendedor) => (
            <option key={vendedor.id} value={vendedor.id}>
              {vendedor.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nominal">Valor del cheque (nominal)</Label>
          <Input
            id="nominal"
            name="nominal"
            inputMode="numeric"
            placeholder="1.000.000"
            autoComplete="off"
            required
            disabled={pendiente}
            value={nominal}
            onChange={(e) => setNominal(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="porcentajeDescuento">Descuento (%)</Label>
          <Input
            id="porcentajeDescuento"
            name="porcentajeDescuento"
            inputMode="decimal"
            placeholder="10"
            autoComplete="off"
            required
            disabled={pendiente}
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4">
        {vista.ok ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm">Pagás ahora, en efectivo</span>
              <span className="text-xl font-semibold tabular-nums">
                {formatearCanonico(vista.montoPagado!)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-muted-foreground">
              <span className="text-sm">Ahorro, cuando lo entregues</span>
              <span className="tabular-nums">{formatearCanonico(vista.ahorro!)}</span>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-3">
              De la caja salen {formatearCanonico(vista.montoPagado!)}. El ahorro no
              es plata que entra: se cuenta recién cuando le entregues el cheque a un
              proveedor y cancele deuda por el valor completo.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{vista.motivo}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="numero">Número</Label>
          <Input id="numero" name="numero" required disabled={pendiente} autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="banco">Banco</Label>
          <Input id="banco" name="banco" required disabled={pendiente} autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaVencimiento">Vencimiento</Label>
          <Input
            id="fechaVencimiento"
            name="fechaVencimiento"
            type="date"
            required
            disabled={pendiente}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="librador">Librador (quién firmó el cheque)</Label>
        <Input id="librador" name="librador" required disabled={pendiente} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacion">Observación (opcional)</Label>
        <Input id="observacion" name="observacion" disabled={pendiente} />
      </div>

      {!resultado.ok && resultado.mensaje && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={pendiente || !vista.ok}>
        {pendiente ? "Registrando…" : "Comprar cheque"}
      </Button>
    </form>
  );
}
