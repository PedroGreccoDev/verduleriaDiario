"use server";

import { redirect } from "next/navigation";
import { ErrorDominio } from "@/lib/errores";
import { iniciarSesion } from "@/lib/sesion";
import { crearPrimerAdministrador } from "@/domain/usuarios/usuario.service";

export interface ResultadoPrimerArranque {
  ok: boolean;
  mensaje?: string;
}

/**
 * Crea el primer administrador y lo deja adentro.
 *
 * Esta acción es la única del sistema que se puede ejecutar sin sesión y sin
 * permisos. Lo que la protege es que `crearPrimerAdministrador` solo funciona con
 * la base sin ningún usuario, y lo verifica dentro de su transacción: una vez que
 * existe alguien, esta acción no vuelve a crear nada nunca.
 */
export async function accionCrearPrimerAdministrador(
  _previo: ResultadoPrimerArranque,
  formulario: FormData,
): Promise<ResultadoPrimerArranque> {
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const usuario = String(formulario.get("usuario") ?? "").trim();
  const contrasena = String(formulario.get("contrasena") ?? "");
  const repetir = String(formulario.get("repetir") ?? "");

  if (contrasena !== repetir) {
    return { ok: false, mensaje: "Las dos contraseñas no coinciden." };
  }

  try {
    const creado = await crearPrimerAdministrador({ nombre, usuario, contrasena });
    await iniciarSesion(creado.id);
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return { ok: false, mensaje: error.message };
    }
    throw error;
  }

  redirect("/configuracion/usuarios");
}
