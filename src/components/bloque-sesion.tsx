import Link from "next/link";
import { accionSalir } from "@/app/ingresar/actions";
import { ETIQUETA_ROL } from "@/domain/usuarios/permisos";
import type { UsuarioVisible } from "@/domain/usuarios/usuario.service";

/**
 * Quién está trabajando, al pie de la barra lateral.
 *
 * Está siempre a la vista por una razón concreta: por decisión del dueño la sesión
 * NO se cierra sola. Como todo lo que se carga queda a nombre de quien esté
 * adentro, el nombre tiene que ser lo primero que se ve al sentarse, y "Salir"
 * tiene que estar a un click. Escondido detrás de un menú, nadie cambia de usuario
 * y el registro de autoría termina diciendo que Marcela trabaja catorce horas.
 */
export function BloqueSesion({ usuario }: { usuario: UsuarioVisible }) {
  return (
    <div className="mt-auto space-y-2">
      <div className="flex flex-col gap-0.5 rounded-xl border border-white/8 bg-white/6 px-3.5 py-3">
        <span className="text-xs text-white/50">
          {ETIQUETA_ROL[usuario.rol]}
        </span>
        <span className="text-sm font-semibold">{usuario.nombre}</span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/mi-cuenta"
          className="flex-1 rounded-lg px-3.5 py-2 text-xs text-white/55 hover:bg-white/7 hover:text-white"
        >
          Mi cuenta
        </Link>

        <form action={accionSalir}>
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/7 hover:text-white"
          >
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}
