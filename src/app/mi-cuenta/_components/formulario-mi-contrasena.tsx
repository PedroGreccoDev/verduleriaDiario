"use client";

import { useActionState } from "react";
import { accionCambiarMiContrasena, type ResultadoAccion } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LARGO_MINIMO_CONTRASENA } from "@/lib/contrasena";

const INICIAL: ResultadoAccion = { ok: true };

export function FormularioMiContrasena() {
  const [resultado, accion, pendiente] = useActionState(
    accionCambiarMiContrasena,
    INICIAL,
  );

  return (
    <form action={accion} className="space-y-4">
      <div className="space-y-2 sm:max-w-xs">
        <Label htmlFor="actual">Contraseña actual</Label>
        <Input
          id="actual"
          name="actual"
          type="password"
          autoComplete="current-password"
          required
          disabled={pendiente}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nueva">Contraseña nueva</Label>
          <Input
            id="nueva"
            name="nueva"
            type="password"
            autoComplete="new-password"
            minLength={LARGO_MINIMO_CONTRASENA}
            required
            disabled={pendiente}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="repetir">Repetir</Label>
          <Input
            id="repetir"
            name="repetir"
            type="password"
            autoComplete="new-password"
            minLength={LARGO_MINIMO_CONTRASENA}
            required
            disabled={pendiente}
          />
        </div>
      </div>

      {resultado.mensaje && (
        <Alert variant={resultado.ok ? "default" : "destructive"} role="alert">
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Cambiando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
