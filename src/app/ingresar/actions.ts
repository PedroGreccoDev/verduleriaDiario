"use server";

import { redirect } from "next/navigation";
import { ErrorDominio } from "@/lib/errores";
import { iniciarSesion, primeraSeccionVisible, terminarSesion } from "@/lib/sesion";
import { verificarCredenciales } from "@/domain/usuarios/usuario.service";

/**
 * Ingreso y salida (§9).
 *
 * TODO(auth) cumplido: el resto de las Server Actions del sistema ahora empiezan
 * con `exigirPermiso`, que es la verificación que faltaba.
 */

export interface ResultadoIngreso {
  ok: boolean;
  mensaje?: string;
}

export async function accionIngresar(
  _previo: ResultadoIngreso,
  formulario: FormData,
): Promise<ResultadoIngreso> {
  const usuario = String(formulario.get("usuario") ?? "").trim();
  const contrasena = String(formulario.get("contrasena") ?? "");
  const volver = String(formulario.get("volver") ?? "");

  if (!usuario || !contrasena) {
    return { ok: false, mensaje: "Completá usuario y contraseña." };
  }

  let destino: string;

  try {
    const autenticado = await verificarCredenciales(usuario, contrasena);
    await iniciarSesion(autenticado.id);

    if (autenticado.debeCambiarContrasena) {
      // Un administrador le puso una contraseña provisoria: no se lo deja trabajar
      // hasta que elija una propia. Si no, la clave que eligió el admin queda
      // vigente y el admin sabe la de todos.
      destino = "/mi-cuenta?cambiar=1";
    } else {
      destino = destinoDespuesDeEntrar(autenticado, volver);
    }
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return { ok: false, mensaje: error.message };
    }
    throw error;
  }

  // `redirect` va FUERA del try: funciona lanzando una excepción que Next
  // intercepta, y adentro del catch quedaría atrapada como si fuera un fallo.
  redirect(destino);
}

/**
 * A dónde va después de entrar.
 *
 * Solo se respeta `volver` si es una ruta interna: un valor como
 * "https://otro-sitio" convertiría la pantalla de ingreso en un trampolín para
 * mandar gente a cualquier lado con la marca del sistema encima.
 */
function destinoDespuesDeEntrar(
  usuario: Parameters<typeof primeraSeccionVisible>[0],
  volver: string,
): string {
  const seccion = primeraSeccionVisible(usuario);

  if (!seccion) return "/sin-permiso?permiso=ninguno";

  if (volver.startsWith("/") && !volver.startsWith("//")) return volver;

  return seccion;
}

export async function accionSalir(): Promise<void> {
  await terminarSesion();
  redirect("/ingresar");
}
