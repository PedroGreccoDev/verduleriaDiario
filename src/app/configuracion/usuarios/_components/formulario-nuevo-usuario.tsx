"use client";

import { useActionState } from "react";
import { accionCrearUsuario, type ResultadoAccion } from "../actions";
import { GrillaPermisos } from "@/components/grilla-permisos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { LARGO_MINIMO_CONTRASENA } from "@/lib/contrasena";
import { PLANTILLAS_ROL } from "@/domain/usuarios/permisos";

const INICIAL: ResultadoAccion = { ok: true };

/**
 * Alta, en el mismo panel donde se configura al resto.
 *
 * Antes era una pantalla aparte. Dar de alta a alguien y decidir qué puede hacer
 * son el mismo momento, así que mandarlo a otra ruta para volver enseguida no
 * aportaba nada.
 */
export function FormularioNuevoUsuario({
  permisosDelObservador,
  alCancelar,
}: {
  permisosDelObservador: readonly string[];
  alCancelar: () => void;
}) {
  const [resultado, accion, pendiente] = useActionState(accionCrearUsuario, INICIAL);

  return (
    <form action={accion} className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-heading text-xl font-semibold">Nuevo usuario</h2>
        <p className="text-sm text-muted-foreground">
          Elegí un rol para arrancar y ajustá los permisos que haga falta.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            name="nombre"
            placeholder="Marcela Gómez"
            autoComplete="off"
            required
            disabled={pendiente}
          />
          <p className="text-xs text-muted-foreground">
            El que va a figurar al lado de lo que cargue.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="usuario">Usuario</Label>
          <Input
            id="usuario"
            name="usuario"
            placeholder="marcela"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            required
            disabled={pendiente}
          />
          <p className="text-xs text-muted-foreground">
            Con esto entra. Sin espacios ni acentos.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contrasena">Contraseña provisoria</Label>
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
        Decísela de palabra. El sistema la va a obligar a elegir una propia la
        primera vez que entre, así que vos no vas a saber su contraseña definitiva.
      </p>

      <Separator />

      <GrillaPermisos
        permisosIniciales={PLANTILLAS_ROL.empleado}
        rolInicial="empleado"
        permisosDelObservador={permisosDelObservador}
        deshabilitado={pendiente}
      />

      {!resultado.ok && resultado.mensaje && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{resultado.mensaje}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? "Creando…" : "Crear usuario"}
        </Button>
        <Button type="button" variant="ghost" disabled={pendiente} onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
