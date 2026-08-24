"use client";

import { useState } from "react";
import type { RolUsuario } from "@/generated/prisma/enums";
import {
  ACCIONES,
  DESCRIPCION_ACCION,
  DESCRIPCION_ROL,
  ETIQUETA_ACCION,
  ETIQUETA_ROL,
  permisosSueltosVisiblesPara,
  PLANTILLAS_ROL,
  rolesVisiblesPara,
  SECCIONES,
  type Accion,
} from "@/domain/usuarios/permisos";

/**
 * La grilla de checkboxes: secciones en las filas, acciones en las columnas.
 *
 * Los checkboxes se llaman todos `permisos` y viajan como valores repetidos del
 * mismo campo, así que el servidor recibe la lista completa de lo tildado con un
 * solo `getAll`. Lo que no vino es lo que se destildó — el formulario manda el
 * estado entero, no un diff.
 *
 * El rol solo escribe los checkboxes: elegirlo los repinta con su plantilla y
 * después se ajusta a mano lo que haga falta. Lo que se guarda es lo tildado, no
 * el rol.
 */

function claveDe(seccion: string, accion: Accion): string {
  return `${seccion}.${accion}`;
}

export function GrillaPermisos({
  permisosIniciales,
  rolInicial,
  permisosDelObservador,
  deshabilitado = false,
}: {
  permisosIniciales: readonly string[];
  rolInicial: RolUsuario;
  /**
   * Los permisos de quien está mirando la pantalla, no los del usuario que se
   * edita. Deciden qué roles y qué casillas se dibujan: un dueño no ve el rol
   * "Administrador" ni el permiso de administración (§9).
   *
   * Es solo la mitad visual de la regla. La que cuenta está en el servidor, en
   * `permisosOtorgablesPor`, porque este formulario es HTML y cualquiera puede
   * agregarle un checkbox a mano.
   */
  permisosDelObservador: readonly string[];
  deshabilitado?: boolean;
}) {
  const [rol, setRol] = useState<RolUsuario>(rolInicial);
  const [concedidos, setConcedidos] = useState<Set<string>>(
    () => new Set(permisosIniciales),
  );

  const roles = rolesVisiblesPara(permisosDelObservador);
  const sueltosVisibles = permisosSueltosVisiblesPara(permisosDelObservador);

  function alternar(permiso: string) {
    setConcedidos((previos) => {
      const siguientes = new Set(previos);
      const [seccion, accion] = permiso.split(".");

      if (siguientes.has(permiso)) {
        siguientes.delete(permiso);

        // Destildar "Ver" arrastra a "Cargar" y "Anular": sin acceso a la sección
        // no hay pantalla desde donde cargar ni anular nada. El servidor aplica la
        // misma regla, así que dejarlas tildadas mostraría un estado que no se
        // va a guardar.
        if (accion === "ver") {
          siguientes.delete(claveDe(seccion, "cargar"));
          siguientes.delete(claveDe(seccion, "anular"));
        }
      } else {
        siguientes.add(permiso);

        // Y al revés: tildar "Cargar" o "Anular" enciende "Ver".
        if (accion === "cargar" || accion === "anular") {
          siguientes.add(claveDe(seccion, "ver"));
        }
      }

      return siguientes;
    });
  }

  function aplicarPlantilla(nuevoRol: RolUsuario) {
    setRol(nuevoRol);

    // Los permisos que este observador no puede ver se conservan tal como estaban:
    // la plantilla no puede quitar algo que la pantalla ni siquiera dibuja. El
    // servidor hace lo mismo al guardar.
    const invisibles = [...concedidos].filter(
      (permiso) => !visibleParaElObservador(permiso),
    );

    setConcedidos(new Set([...PLANTILLAS_ROL[nuevoRol], ...invisibles]));
  }

  function visibleParaElObservador(permiso: string): boolean {
    if (!permiso.startsWith("usuarios.")) return true;

    return sueltosVisibles.some((suelto) => suelto.clave === permiso);
  }

  return (
    <div className="space-y-6">
      <input type="hidden" name="rol" value={rol} />

      <fieldset className="space-y-2" disabled={deshabilitado}>
        <legend className="text-sm font-medium">Rol</legend>
        <p className="text-xs text-muted-foreground">
          Marca los permisos de arranque. Después ajustá lo que quieras: lo que se
          guarda es lo que quede tildado abajo.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {roles.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => aplicarPlantilla(opcion)}
              disabled={deshabilitado}
              title={DESCRIPCION_ROL[opcion]}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                rol === opcion
                  ? "border-foreground bg-foreground text-background"
                  : "hover:bg-accent"
              }`}
            >
              {ETIQUETA_ROL[opcion]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{DESCRIPCION_ROL[rol]}</p>
      </fieldset>

      <fieldset disabled={deshabilitado} className="space-y-3">
        <legend className="text-sm font-medium">Permisos</legend>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium">Sección</th>
                {ACCIONES.map((accion) => (
                  <th
                    key={accion}
                    title={DESCRIPCION_ACCION[accion]}
                    className="w-20 py-2 text-center font-medium"
                  >
                    {ETIQUETA_ACCION[accion]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECCIONES.map((seccion) => (
                <tr key={seccion.clave} className="border-b last:border-0">
                  <td className="py-2.5">{seccion.etiqueta}</td>
                  {ACCIONES.map((accion) => {
                    const aplica = seccion.acciones.includes(accion);
                    const permiso = claveDe(seccion.clave, accion);

                    return (
                      <td key={accion} className="py-2.5 text-center">
                        {aplica ? (
                          <input
                            type="checkbox"
                            name="permisos"
                            value={permiso}
                            checked={concedidos.has(permiso)}
                            onChange={() => alternar(permiso)}
                            aria-label={`${ETIQUETA_ACCION[accion]} ${seccion.etiqueta}`}
                            className="h-4 w-4 accent-foreground"
                          />
                        ) : (
                          // Reportes no se carga ni se anula: se mira. Una casilla
                          // ahí invitaría a tildarla y a no entender por qué no hace
                          // nada.
                          <span className="text-muted-foreground" aria-hidden="true">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 pt-2">
          {sueltosVisibles.map((permiso) => (
            <label key={permiso.clave} className="flex items-start gap-2.5">
              <input
                type="checkbox"
                name="permisos"
                value={permiso.clave}
                checked={concedidos.has(permiso.clave)}
                onChange={() => alternar(permiso.clave)}
                className="mt-0.5 h-4 w-4 accent-foreground"
              />
              <span>
                <span className="block text-sm">{permiso.etiqueta}</span>
                <span className="block text-xs text-muted-foreground">
                  {permiso.descripcion}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
