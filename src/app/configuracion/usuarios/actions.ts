"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErrorDominio, errorDominio } from "@/lib/errores";
import { exigirPermiso } from "@/lib/sesion";
import { cerrarSesionesDe } from "@/domain/usuarios/sesion.service";
import type { RolUsuario } from "@/generated/prisma/enums";
import { rolesVisiblesPara } from "@/domain/usuarios/permisos";
import type { UsuarioVisible } from "@/domain/usuarios/usuario.service";
import {
  actualizarPermisos,
  borrarUsuario,
  cambiarActivacion,
  crearUsuario,
  editarUsuario,
  obtenerUsuario,
  restablecerContrasena,
} from "@/domain/usuarios/usuario.service";

/**
 * Server Actions de la pantalla de usuarios (§9).
 *
 * TODAS empiezan por `exigirPermiso("usuarios.configurar")`. No es redundante con
 * el filtro de la pantalla: una Server Action es un endpoint POST y se alcanza sin
 * pasar por ninguna pantalla. Ocultar el botón no protege nada.
 *
 * Y todas le pasan al dominio los permisos de quien las ejecuta, porque no
 * alcanza con saber que puede configurar: hay que saber A QUIÉN puede tocar. Un
 * dueño no ve ni puede modificar las cuentas de administrador, y el id del
 * objetivo viaja por POST, donde cualquiera lo puede cambiar.
 */

export interface ResultadoAccion {
  ok: boolean;
  mensaje?: string;
}

const EXITO: ResultadoAccion = { ok: true };

async function ejecutar(
  accion: (actor: UsuarioVisible) => Promise<unknown>,
): Promise<ResultadoAccion> {
  try {
    const actor = await exigirPermiso("usuarios.configurar");
    await accion(actor);
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return { ok: false, mensaje: error.message };
    }
    throw error;
  }

  revalidatePath("/configuracion/usuarios");
  return EXITO;
}

/**
 * El rol tiene que ser uno de los que el actor puede ver. Sin esto, un dueño
 * mandaría `rol=admin` por POST y crearía una cuenta que después le desaparece de
 * la pantalla.
 */
function rolDeFormulario(formulario: FormData, actor: UsuarioVisible): RolUsuario {
  const rol = String(formulario.get("rol") ?? "");
  const permitidos = rolesVisiblesPara(actor.permisos);

  if (!permitidos.includes(rol as RolUsuario)) {
    throw errorDominio("USUARIO_INVALIDO", "Elegí un rol válido.");
  }

  return rol as RolUsuario;
}

/** Los checkboxes viajan todos con el mismo nombre; acá se juntan. */
function permisosDeFormulario(formulario: FormData): string[] {
  return formulario.getAll("permisos").map(String);
}

export async function accionCrearUsuario(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const contrasena = String(formulario.get("contrasena") ?? "");
  const repetir = String(formulario.get("repetir") ?? "");

  if (contrasena !== repetir) {
    return { ok: false, mensaje: "Las dos contraseñas no coinciden." };
  }

  return ejecutar((actor) =>
    crearUsuario({
      nombre: String(formulario.get("nombre") ?? ""),
      usuario: String(formulario.get("usuario") ?? ""),
      contrasena,
      rol: rolDeFormulario(formulario, actor),
      // El dominio descarta lo que el actor no pueda otorgar; acá no se filtra
      // nada para no tener la misma regla escrita en dos lugares que puedan
      // separarse con el tiempo.
      permisos: permisosDeFormulario(formulario),
      // La contraseña la eligió quien crea la cuenta, no la persona: la cambia en
      // su primer ingreso. Si no, quien la creó conoce la clave de todo el mundo.
      debeCambiarContrasena: true,
    }),
  );
}

export async function accionGuardarUsuario(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const usuarioId = String(formulario.get("usuarioId") ?? "");

  const resultado = await ejecutar(async (actor) => {
    await editarUsuario(
      usuarioId,
      {
        nombre: String(formulario.get("nombre") ?? ""),
        rol: rolDeFormulario(formulario, actor),
      },
      actor.permisos,
    );

    // Los permisos van después del rol a propósito: `editarUsuario` no los toca,
    // así que lo que manda siempre es la grilla.
    await actualizarPermisos(usuarioId, permisosDeFormulario(formulario), actor.permisos);
  });

  // Los permisos gobiernan la barra lateral, que vive en el layout raíz: sin esto,
  // alguien que se cambia sus propios permisos sigue viendo el menú viejo.
  revalidatePath("/", "layout");

  return resultado;
}

/**
 * Guarda solo el nombre.
 *
 * Separada de `accionGuardarUsuario` a propósito: esa reemplaza la lista completa
 * de permisos, así que usarla para renombrar obligaría al formulario del nombre a
 * reenviar todos los permisos en campos ocultos. Un formulario que manda datos que
 * no muestra es un formulario que un día los manda mal.
 */
export async function accionGuardarNombre(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const usuarioId = String(formulario.get("usuarioId") ?? "");

  const resultado = await ejecutar((actor) =>
    editarUsuario(usuarioId, { nombre: String(formulario.get("nombre") ?? "") }, actor.permisos),
  );

  return resultado;
}

export async function accionRestablecerContrasena(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const usuarioId = String(formulario.get("usuarioId") ?? "");
  const contrasena = String(formulario.get("contrasena") ?? "");
  const repetir = String(formulario.get("repetir") ?? "");

  if (contrasena !== repetir) {
    return { ok: false, mensaje: "Las dos contraseñas no coinciden." };
  }

  const resultado = await ejecutar((actor) =>
    restablecerContrasena(usuarioId, contrasena, actor.permisos),
  );

  return resultado;
}

export async function accionCambiarActivacion(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const usuarioId = String(formulario.get("usuarioId") ?? "");
  const activo = String(formulario.get("activo") ?? "") === "1";

  const resultado = await ejecutar((actor) =>
    cambiarActivacion(usuarioId, activo, actor.permisos),
  );

  return resultado;
}

/**
 * Borrado real. El dominio exige `usuarios.administrar` además de
 * `usuarios.configurar`, así que un dueño que llegue hasta acá por POST recibe un
 * mensaje que le ofrece la baja.
 */
export async function accionBorrarUsuario(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const usuarioId = String(formulario.get("usuarioId") ?? "");
  const confirmacion = String(formulario.get("confirmacion") ?? "").trim();

  // Escribir el nombre de ingreso es la confirmación. Es destructivo y no tiene
  // vuelta atrás: los movimientos de esa persona quedan sin autor para siempre.
  if (!confirmacion) {
    return {
      ok: false,
      mensaje: "Escribí el usuario de la cuenta para confirmar que la querés borrar.",
    };
  }

  const esperado = String(formulario.get("usuarioEsperado") ?? "");
  if (confirmacion !== esperado) {
    return {
      ok: false,
      mensaje: `Para borrarla hay que escribir "${esperado}" exactamente.`,
    };
  }

  const resultado = await ejecutar((actor) =>
    borrarUsuario(usuarioId, { id: actor.id, permisos: actor.permisos }),
  );

  if (resultado.ok) redirect("/configuracion/usuarios");

  return resultado;
}

export async function accionCerrarSesiones(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const usuarioId = String(formulario.get("usuarioId") ?? "");

  const resultado = await ejecutar(async (actor) => {
    // Cerrarle la sesión a alguien que no se puede ni ver sería tocar una cuenta
    // invisible: se comprueba con la misma regla que el resto.
    await obtenerUsuario(usuarioId, actor.permisos);

    return cerrarSesionesDe(usuarioId);
  });

  return resultado;
}
