"use client";

import { useActionState } from "react";
import { accionIngresar, type ResultadoIngreso } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const INICIAL: ResultadoIngreso = { ok: true };

export function FormularioIngreso({ volver }: { volver: string }) {
  const [resultado, accion, pendiente] = useActionState(accionIngresar, INICIAL);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="volver" value={volver} />

      <div className="space-y-2">
        <Label htmlFor="usuario">Usuario</Label>
        <Input
          id="usuario"
          name="usuario"
          // El foco arranca acá: al abrir el sistema se tipea sin tocar el mouse.
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          required
          disabled={pendiente}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contrasena">Contraseña</Label>
        <Input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          disabled={pendiente}
        />
      </div>

      {!resultado.ok && resultado.mensaje && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
