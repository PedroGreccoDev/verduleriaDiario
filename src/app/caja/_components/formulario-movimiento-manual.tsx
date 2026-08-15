"use client";

import { useActionState, useRef, useState } from "react";
import { accionRegistrarMovimiento, type ResultadoAccion } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MensajeError } from "./mensaje-error";

const INICIAL: ResultadoAccion = { ok: true };

export interface CategoriaCargable {
  id: string;
  nombre: string;
  tipo: "ingreso" | "egreso";
}

/**
 * Carga a mano de un gasto o un ingreso de la Bolsa Grande (§3.1).
 *
 * No hay ningún control para elegir ingreso o egreso: lo dice la categoría. Un
 * par de campos "tipo" y "categoría" separados permitiría cargar una nafta como
 * ingreso, y la caja quedaría descuadrada sin que nada avise.
 *
 * Por eso las opciones vienen agrupadas por tipo y el texto de abajo repite qué
 * va a pasar con la plata: el operador confirma leyendo, no deduciendo.
 */
export function FormularioMovimientoManual({
  categorias,
  hayTurnoAbierto,
}: {
  categorias: CategoriaCargable[];
  hayTurnoAbierto: boolean;
}) {
  const [resultado, accion, pendiente] = useActionState(accionRegistrarMovimiento, INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const [categoriaId, setCategoriaId] = useState("");

  const elegida = categorias.find((categoria) => categoria.id === categoriaId) ?? null;
  const ingresos = categorias.filter((categoria) => categoria.tipo === "ingreso");
  const egresos = categorias.filter((categoria) => categoria.tipo === "egreso");

  return (
    <form
      ref={formulario}
      action={async (datos) => {
        await accion(datos);
        // Se limpia siempre, igual que el retiro: dejar un monto inválido en el
        // campo invita a apretar enviar de nuevo sin corregirlo.
        formulario.current?.reset();
        setCategoriaId("");
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor="categoriaId">Concepto</Label>
          <select
            id="categoriaId"
            name="categoriaId"
            required
            disabled={pendiente}
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="">Elegí…</option>
            <optgroup label="Sale plata">
              {egresos.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </optgroup>
            <optgroup label="Entra plata">
              {ingresos.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="monto-movimiento">Monto</Label>
          <Input
            id="monto-movimiento"
            name="monto"
            inputMode="numeric"
            placeholder="8.000"
            autoComplete="off"
            required
            disabled={pendiente}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacion-movimiento">Detalle</Label>
        <Input
          id="observacion-movimiento"
          name="observacion"
          placeholder="Nafta de la camioneta, arreglo de la balanza…"
          autoComplete="off"
          disabled={pendiente}
        />
      </div>

      {elegida && (
        <p className="text-sm">
          {elegida.tipo === "egreso"
            ? "Sale plata de la Bolsa Grande."
            : "Entra plata a la Bolsa Grande."}{" "}
          <span className="text-muted-foreground">
            {hayTurnoAbierto
              ? "Queda en el turno abierto."
              : "Como no hay turno abierto, queda registrado fuera de turno."}
          </span>
        </p>
      )}

      <MensajeError resultado={resultado} />

      <Button type="submit" disabled={pendiente} variant="secondary">
        {pendiente ? "Registrando…" : "Registrar movimiento"}
      </Button>
    </form>
  );
}
