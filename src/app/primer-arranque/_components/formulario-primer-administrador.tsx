"use client";

import { useActionState } from "react";
import {
  accionCrearPrimerAdministrador,
  type ResultadoPrimerArranque,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LARGO_MINIMO_CONTRASENA } from "@/lib/contrasena";

const INICIAL: ResultadoPrimerArranque = { ok: true };

export function FormularioPrimerAdministrador() {
  const [resultado, accion, pendiente] = useActionState(
    accionCrearPrimerAdministrador,
    INICIAL,
  );

  return (
    <form action={accion} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nombre">Tu nombre</Label>
        <Input
          id="nombre"
          name="nombre"
          placeholder="Rami Vélez"
          autoFocus
          autoComplete="name"
          required
          disabled={pendiente}
        />
        <p className="text-xs text-muted-foreground">
          Es el que va a figurar al lado de cada cosa que cargues.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="usuario">Usuario</Label>
        <Input
          id="usuario"
          name="usuario"
          placeholder="rami"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          required
          disabled={pendiente}
        />
        <p className="text-xs text-muted-foreground">
          Con esto entrás. Sin espacios ni acentos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contrasena">Contraseña</Label>
          <Input
            id="contrasena"
            name="contrasena"
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

      <p className="text-xs text-muted-foreground">
        Al menos {LARGO_MINIMO_CONTRASENA} caracteres. Nadie te la puede recordar
        después: si se pierde, se restablece desde otra cuenta con permiso para
        configurar usuarios, y esta es la primera que existe.
      </p>

      {!resultado.ok && resultado.mensaje && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={pendiente}>
        {pendiente ? "Creando…" : "Crear y entrar"}
      </Button>
    </form>
  );
}
