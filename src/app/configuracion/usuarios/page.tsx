import { requerirPermiso } from "@/lib/sesion";
import { listarUsuarios } from "@/domain/usuarios/usuario.service";
import { contarSesionesPorUsuario } from "@/domain/usuarios/sesion.service";
import { PERMISO_ADMINISTRAR } from "@/domain/usuarios/permisos";
import { PanelUsuarios } from "./_components/panel-usuarios";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Usuarios — Estación Verde",
};

/**
 * Toda la sección en una sola pantalla: la lista de gente a la izquierda y la
 * configuración de quien esté elegido a la derecha, incluida el alta.
 *
 * Antes eran tres pantallas —listado, ficha y alta— más un modal encima. Para un
 * local con un puñado de cuentas, cada salto costaba más de lo que ordenaba.
 */
export default async function PaginaUsuarios() {
  const yo = await requerirPermiso("usuarios.configurar");

  const usuarios = await listarUsuarios(yo.permisos);
  const sesionesPorUsuario = await contarSesionesPorUsuario();

  return (
    <main className="app-page space-y-8">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Quién entra al sistema y qué puede hacer cada uno.
        </p>
      </header>

      <PanelUsuarios
        usuarios={usuarios}
        permisosDelObservador={yo.permisos}
        idPropio={yo.id}
        puedeBorrar={yo.permisos.includes(PERMISO_ADMINISTRAR)}
        // Un Map no se puede serializar hacia un componente de cliente: viaja como
        // pares y se reconstruye del otro lado.
        sesionesPorUsuario={[...sesionesPorUsuario.entries()]}
      />
    </main>
  );
}
