"use client";

import { useActionState } from "react";
import {
  accionBorrarUsuario,
  accionCambiarActivacion,
  accionCerrarSesiones,
  accionGuardarNombre,
  accionGuardarUsuario,
  accionRestablecerContrasena,
  type ResultadoAccion,
} from "../actions";
import { GrillaPermisos } from "@/components/grilla-permisos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LARGO_MINIMO_CONTRASENA } from "@/lib/contrasena";
import { ETIQUETA_ROL } from "@/domain/usuarios/permisos";
import type { UsuarioVisible } from "@/domain/usuarios/usuario.service";

/**
 * La configuración de una persona, para mostrar al lado de la lista.
 *
 * Antes era una ventana que se abría encima. Se sacó: entre la barra lateral, la
 * lista y el modal había tres capas para una tarea corta, y el modal tapaba
 * justamente la lista contra la que uno compara —"¿Marcela tiene lo mismo que
 * Rami?"—. Acá las dos cosas se ven a la vez.
 *
 * Datos y permisos siguen separados en solapas porque se tocan en momentos
 * distintos: los datos el día que alguien entra o se olvida la contraseña, los
 * permisos cuando cambia lo que hace.
 */

const INICIAL: ResultadoAccion = { ok: true };

function Mensaje({ resultado, exito }: { resultado: ResultadoAccion; exito: string }) {
  if (resultado.ok && !resultado.mensaje) return null;

  return (
    <Alert variant={resultado.ok ? "default" : "destructive"} role="alert">
      <AlertDescription>{resultado.ok ? exito : resultado.mensaje}</AlertDescription>
    </Alert>
  );
}

export function ConfiguracionUsuario({
  usuario,
  permisosDelObservador,
  esUnoMismo,
  puedeBorrar,
  sesionesAbiertas,
}: {
  usuario: UsuarioVisible;
  permisosDelObservador: readonly string[];
  esUnoMismo: boolean;
  puedeBorrar: boolean;
  sesionesAbiertas: number;
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-xl font-semibold">{usuario.nombre}</h2>
          {esUnoMismo && (
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
              sos vos
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Entra como <span className="font-medium">{usuario.usuario}</span> ·{" "}
          {ETIQUETA_ROL[usuario.rol]}
          {!usuario.activo && " · dada de baja"}
          {usuario.debeCambiarContrasena && " · contraseña provisoria sin cambiar"}
        </p>
      </header>

      {/* `key` con el id: al cambiar de persona en la lista, las solapas vuelven a
          "Datos" y los formularios se remontan con los valores del nuevo. Sin
          esto, el nombre tipeado para uno quedaría en el campo del siguiente. */}
      <Tabs defaultValue="datos" key={usuario.id}>
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="permisos">Permisos</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-5">
          <FormularioNombre usuarioId={usuario.id} nombre={usuario.nombre} />

          <Separator />

          <Seccion
            titulo="Contraseña"
            ayuda="Para cuando se la olvidó. La anterior no se puede recuperar: nadie, ni vos ni el sistema, la puede leer."
          >
            <FormularioRestablecer usuarioId={usuario.id} />
          </Seccion>

          <Separator />

          <Seccion
            titulo="Sesiones abiertas"
            ayuda={
              sesionesAbiertas === 0
                ? "No tiene ninguna abierta."
                : `Tiene ${sesionesAbiertas} abierta${sesionesAbiertas === 1 ? "" : "s"}. Las sesiones no se cierran solas: cerralas si quedó una en una máquina que no corresponde.`
            }
          >
            <BotonCerrarSesiones usuarioId={usuario.id} cantidad={sesionesAbiertas} />
          </Seccion>

          <Separator />

          <Seccion
            titulo={usuario.activo ? "Dar de baja" : "Reactivar"}
            ayuda="Una cuenta de baja no puede entrar, y todo lo que cargó sigue mostrando su nombre."
          >
            <BotonActivacion
              usuarioId={usuario.id}
              activo={usuario.activo}
              esUnoMismo={esUnoMismo}
            />
          </Seccion>

          {puedeBorrar && (
            <>
              <Separator />
              <Seccion
                titulo="Borrar la cuenta"
                destacado
                ayuda="Distinto de dar de baja: la cuenta desaparece y todo lo que cargó queda sin autor, con el mismo guion que lo anterior a los usuarios. No se puede deshacer."
              >
                <FormularioBorrar
                  usuarioId={usuario.id}
                  usuario={usuario.usuario}
                  esUnoMismo={esUnoMismo}
                />
              </Seccion>
            </>
          )}
        </TabsContent>

        <TabsContent value="permisos">
          <SolapaPermisos
            usuario={usuario}
            permisosDelObservador={permisosDelObservador}
            esUnoMismo={esUnoMismo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Seccion({
  titulo,
  ayuda,
  destacado = false,
  children,
}: {
  titulo: string;
  ayuda: string;
  destacado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3
          className={`text-sm font-medium ${destacado ? "text-destructive" : ""}`}
        >
          {titulo}
        </h3>
        <p className="text-xs text-muted-foreground">{ayuda}</p>
      </div>
      {children}
    </section>
  );
}

function SolapaPermisos({
  usuario,
  permisosDelObservador,
  esUnoMismo,
}: {
  usuario: UsuarioVisible;
  permisosDelObservador: readonly string[];
  esUnoMismo: boolean;
}) {
  const [resultado, accion, pendiente] = useActionState(accionGuardarUsuario, INICIAL);

  return (
    <form action={accion} className="space-y-5">
      <input type="hidden" name="usuarioId" value={usuario.id} />
      {/* `accionGuardarUsuario` valida el nombre además de guardar rol y permisos:
          viaja sin cambios para que guardar permisos no lo altere. */}
      <input type="hidden" name="nombre" value={usuario.nombre} />

      {esUnoMismo && (
        <Alert>
          <AlertDescription>
            Son tus propios permisos: lo que destildes lo dejás de poder hacer vos.
          </AlertDescription>
        </Alert>
      )}

      <GrillaPermisos
        key={usuario.permisos.join(",")}
        permisosIniciales={usuario.permisos}
        rolInicial={usuario.rol}
        permisosDelObservador={permisosDelObservador}
        deshabilitado={pendiente}
      />

      <Mensaje resultado={resultado} exito="Permisos guardados." />

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar permisos"}
      </Button>
    </form>
  );
}

/** Solo el nombre. Su acción no toca los permisos. */
function FormularioNombre({
  usuarioId,
  nombre,
}: {
  usuarioId: string;
  nombre: string;
}) {
  const [resultado, accion, pendiente] = useActionState(accionGuardarNombre, INICIAL);

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />

      <div className="space-y-2 sm:max-w-sm">
        <Label htmlFor={`nombre-${usuarioId}`}>Nombre</Label>
        <Input
          id={`nombre-${usuarioId}`}
          name="nombre"
          defaultValue={nombre}
          autoComplete="off"
          required
          disabled={pendiente}
        />
        <p className="text-xs text-muted-foreground">
          Es el que figura al lado de cada cosa que carga.
        </p>
      </div>

      <Mensaje resultado={resultado} exito="Nombre guardado." />

      <Button type="submit" size="sm" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar nombre"}
      </Button>
    </form>
  );
}

function FormularioRestablecer({ usuarioId }: { usuarioId: string }) {
  const [resultado, accion, pendiente] = useActionState(
    accionRestablecerContrasena,
    INICIAL,
  );

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />

      <div className="grid gap-3 sm:max-w-lg sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`nueva-${usuarioId}`}>Nueva</Label>
          <Input
            id={`nueva-${usuarioId}`}
            name="contrasena"
            type="password"
            autoComplete="new-password"
            minLength={LARGO_MINIMO_CONTRASENA}
            required
            disabled={pendiente}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`repetir-${usuarioId}`}>Repetir</Label>
          <Input
            id={`repetir-${usuarioId}`}
            name="repetir"
            type="password"
            autoComplete="new-password"
            minLength={LARGO_MINIMO_CONTRASENA}
            required
            disabled={pendiente}
          />
        </div>
      </div>

      <Mensaje
        resultado={resultado}
        exito="Listo. Decísela de palabra: la va a tener que cambiar al entrar."
      />

      <Button type="submit" size="sm" variant="secondary" disabled={pendiente}>
        {pendiente ? "Restableciendo…" : "Restablecer contraseña"}
      </Button>
    </form>
  );
}

function BotonActivacion({
  usuarioId,
  activo,
  esUnoMismo,
}: {
  usuarioId: string;
  activo: boolean;
  esUnoMismo: boolean;
}) {
  const [resultado, accion, pendiente] = useActionState(accionCambiarActivacion, INICIAL);

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <input type="hidden" name="activo" value={activo ? "0" : "1"} />

      <Mensaje resultado={resultado} exito="Listo." />

      <Button
        type="submit"
        size="sm"
        variant={activo ? "destructive" : "secondary"}
        // Darse de baja a uno mismo deja al operador afuera en el próximo click.
        disabled={pendiente || esUnoMismo}
      >
        {activo ? "Dar de baja" : "Reactivar"}
      </Button>

      {esUnoMismo && (
        <p className="text-xs text-muted-foreground">
          No podés darte de baja a vos mismo.
        </p>
      )}
    </form>
  );
}

function BotonCerrarSesiones({
  usuarioId,
  cantidad,
}: {
  usuarioId: string;
  cantidad: number;
}) {
  const [resultado, accion, pendiente] = useActionState(accionCerrarSesiones, INICIAL);

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />

      <Mensaje resultado={resultado} exito="Sesiones cerradas." />

      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pendiente || cantidad === 0}
      >
        {cantidad === 0
          ? "No hay sesiones abiertas"
          : `Cerrar ${cantidad} sesión${cantidad === 1 ? "" : "es"}`}
      </Button>
    </form>
  );
}

/**
 * Borrado real (§9). Solo aparece para quien tiene permiso de administración.
 *
 * Pide escribir el nombre de ingreso porque no tiene vuelta atrás y porque se
 * lleva puesta información que no está en ningún otro lado: los movimientos que
 * esa persona cargó quedan sin autor para siempre.
 */
function FormularioBorrar({
  usuarioId,
  usuario,
  esUnoMismo,
}: {
  usuarioId: string;
  usuario: string;
  esUnoMismo: boolean;
}) {
  const [resultado, accion, pendiente] = useActionState(accionBorrarUsuario, INICIAL);

  if (esUnoMismo) {
    return (
      <p className="text-xs text-muted-foreground">
        No podés borrar tu propia cuenta. Pedíselo a otro administrador.
      </p>
    );
  }

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <input type="hidden" name="usuarioEsperado" value={usuario} />

      <div className="space-y-2 sm:max-w-xs">
        <Label htmlFor={`confirmar-${usuarioId}`}>
          Escribí <span className="font-mono font-medium">{usuario}</span> para
          confirmar
        </Label>
        <Input
          id={`confirmar-${usuarioId}`}
          name="confirmacion"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={pendiente}
        />
      </div>

      <Mensaje resultado={resultado} exito="Cuenta borrada." />

      <Button type="submit" size="sm" variant="destructive" disabled={pendiente}>
        {pendiente ? "Borrando…" : "Borrar para siempre"}
      </Button>
    </form>
  );
}
