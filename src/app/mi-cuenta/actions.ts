"use server";

import { revalidatePath } from "next/cache";
import { ErrorDominio } from "@/lib/errores";
import { requerirUsuario } from "@/lib/sesion";
import { cambiarContrasenaPropia } from "@/domain/usuarios/usuario.service";

export interface ResultadoAccion {
  ok: boolean;
  mensaje?: string;
}

export async function accionCambiarMiContrasena(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const actual = String(formulario.get("actual") ?? "");
  const nueva = String(formulario.get("nueva") ?? "");
  const repetir = String(formulario.get("repetir") ?? "");

  if (nueva !== repetir) {
    return { ok: false, mensaje: "Las dos contraseñas nuevas no coinciden." };
  }

  if (nueva === actual) {
    return { ok: false, mensaje: "La contraseña nueva tiene que ser distinta de la actual." };
  }

  try {
    // El id sale de la sesión, NUNCA del formulario: si viniera del formulario,
    // cualquiera podría mandar el id de otro y cambiarle la contraseña.
    const usuario = await requerirUsuario();
    await cambiarContrasenaPropia(usuario.id, actual, nueva);
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return { ok: false, mensaje: error.message };
    }
    throw error;
  }

  revalidatePath("/mi-cuenta");
  return { ok: true, mensaje: "Contraseña cambiada." };
}
