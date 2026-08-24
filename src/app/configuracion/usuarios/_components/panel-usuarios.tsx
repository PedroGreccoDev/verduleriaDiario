"use client";

import { useState } from "react";
import { ConfiguracionUsuario } from "./configuracion-usuario";
import { FormularioNuevoUsuario } from "./formulario-nuevo-usuario";
import { Button } from "@/components/ui/button";
import { ETIQUETA_ROL } from "@/domain/usuarios/permisos";
import type { UsuarioVisible } from "@/domain/usuarios/usuario.service";

/**
 * Toda la sección en una sola vista: la lista a la izquierda, la configuración de
 * quien esté elegido a la derecha.
 *
 * Reemplaza al modal que se abría encima. El modal tapaba la lista, que es
 * justamente contra lo que uno compara —"¿Marcela tiene lo mismo que Rami?"— y
 * agregaba una tercera capa (barra lateral, lista, ventana) para una tarea de
 * treinta segundos. Acá se ve todo junto y cambiar de persona es un click.
 *
 * El alta vive en el mismo panel derecho, en vez de en su propia pantalla: dar de
 * alta a alguien y configurarlo son el mismo momento, y mandarlo a otra ruta para
 * volver enseguida no aportaba nada.
 */
export function PanelUsuarios({
  usuarios,
  permisosDelObservador,
  idPropio,
  puedeBorrar,
  sesionesPorUsuario,
}: {
  usuarios: readonly UsuarioVisible[];
  permisosDelObservador: readonly string[];
  idPropio: string;
  puedeBorrar: boolean;
  /** Pares [usuarioId, cantidad]: un Map no cruza la frontera del servidor. */
  sesionesPorUsuario: readonly (readonly [string, number])[];
}) {
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [dandoDeAlta, setDandoDeAlta] = useState(false);

  const sesiones = new Map(sesionesPorUsuario);

  // Quién se muestra a la derecha se DERIVA, no se guarda aparte: si nadie fue
  // elegido todavía, o si a quien estaba elegido lo borraron, cae en el primero de
  // la lista. Sincronizar dos estados con un efecto sería el mismo resultado con
  // un render de más y un caso raro donde el panel queda vacío sin explicación.
  const seleccionado =
    usuarios.find((u) => u.id === seleccionadoId) ?? usuarios[0] ?? null;

  function elegir(id: string) {
    setSeleccionadoId(id);
    setDandoDeAlta(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(220px,260px)_1fr] lg:items-start">
      <aside className="space-y-3">
        <Button
          type="button"
          variant={dandoDeAlta ? "default" : "outline"}
          className="w-full"
          onClick={() => setDandoDeAlta(true)}
        >
          Nuevo usuario
        </Button>

        <ul className="space-y-1">
          {usuarios.map((usuario) => {
            const elegido = !dandoDeAlta && usuario.id === seleccionadoId;

            return (
              <li key={usuario.id}>
                <button
                  type="button"
                  onClick={() => elegir(usuario.id)}
                  aria-current={elegido ? "true" : undefined}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                    elegido ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {usuario.nombre}
                    </span>
                    {usuario.id === idPropio && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        (vos)
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {ETIQUETA_ROL[usuario.rol]}
                    {!usuario.activo && " · de baja"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="min-w-0 rounded-xl border bg-card p-5 md:p-6">
        {dandoDeAlta ? (
          <FormularioNuevoUsuario
            permisosDelObservador={permisosDelObservador}
            alCancelar={() => setDandoDeAlta(false)}
          />
        ) : seleccionado ? (
          <ConfiguracionUsuario
            usuario={seleccionado}
            permisosDelObservador={permisosDelObservador}
            esUnoMismo={seleccionado.id === idPropio}
            puedeBorrar={puedeBorrar}
            sesionesAbiertas={sesiones.get(seleccionado.id) ?? 0}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Elegí a alguien de la lista para ver su configuración.
          </p>
        )}
      </div>
    </div>
  );
}
