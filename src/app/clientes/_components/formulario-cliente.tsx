"use client";

import { useActionState, useState } from "react";
import { accionRegistrarCliente, type ResultadoAccion } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const INICIAL: ResultadoAccion = { ok: true };

/**
 * Alta de cliente, plegada detrás de un botón.
 *
 * La pantalla se usa mil veces para consultar quién debe y una para dar de alta:
 * el formulario abierto todo el tiempo empujaría la lista —que es lo que se viene
 * a ver— abajo del pliegue.
 */
export function FormularioCliente() {
  const [resultado, accion, pendiente] = useActionState(accionRegistrarCliente, INICIAL);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <Button variant="outline" onClick={() => setAbierto(true)}>
        Nuevo cliente
      </Button>
    );
  }

  return (
    <form action={accion} className="w-full space-y-4 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            name="nombre"
            placeholder="Rosa Giménez"
            autoComplete="off"
            required
            disabled={pendiente}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            name="telefono"
            placeholder="Opcional"
            autoComplete="off"
            disabled={pendiente}
          />
          <p className="text-xs text-muted-foreground">
            Es lo que distingue a dos clientes que se llaman igual.
          </p>
        </div>
      </div>

      {!resultado.ok && resultado.mensaje && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Creando…" : "Crear y abrir cuenta"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pendiente}
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
