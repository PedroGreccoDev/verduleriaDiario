import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { errorDominio } from "@/lib/errores";
import { etiquetaPermiso, SECCIONES } from "@/domain/usuarios/permisos";
import {
  abrirSesion,
  cerrarSesion,
  usuarioDeSesion,
  type SesionActiva,
} from "@/domain/usuarios/sesion.service";
import type { UsuarioVisible } from "@/domain/usuarios/usuario.service";

/**
 * Punto único por donde el resto de la aplicación pregunta quién está trabajando.
 *
 * Todo lo que decide permisos pasa por acá, y acá se lee la cookie. Ninguna
 * pantalla ni ningún servicio de dominio lee cookies por su cuenta: el dominio no
 * sabe que existe HTTP, y las pantallas no deciden nada de seguridad.
 */

export const COOKIE_SESION = "verde_sesion";

/**
 * Diez años. La decisión del dueño fue que la sesión no se cierre sola, y una
 * cookie sin vencimiento explícito muere al cerrar el navegador — que en una PC
 * de mostrador pasa todos los días. La sesión termina cuando alguien toca "Salir"
 * o cuando un administrador la cierra, no cuando se apaga la máquina.
 */
const SEGUNDOS_COOKIE = 10 * 365 * 24 * 60 * 60;

/**
 * `secure` exige HTTPS y la PC del local corre sobre http plano: prenderlo ahí
 * haría que el navegador descarte la cookie y nadie pueda entrar nunca. Se activa
 * solo si el despliegue declara que hay TLS.
 */
const EXIGIR_HTTPS = process.env.SESION_SOLO_HTTPS === "1";

export async function iniciarSesion(usuarioId: string): Promise<void> {
  const token = await abrirSesion(usuarioId);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: EXIGIR_HTTPS,
    sameSite: "lax",
    path: "/",
    maxAge: SEGUNDOS_COOKIE,
  });
}

export async function terminarSesion(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESION)?.value;

  if (token) await cerrarSesion(token);

  cookieStore.delete(COOKIE_SESION);
}

/**
 * Quién está trabajando, o `null` si no hay nadie.
 *
 * `cache` memoiza por render: una pantalla que consulta la sesión desde el layout,
 * desde la página y desde tres componentes hace una sola consulta a la base.
 */
export const sesionActual = cache(async (): Promise<SesionActiva | null> => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;

  if (!token) return null;

  return usuarioDeSesion(token);
});

/** ¿Este usuario tiene este permiso? */
export function puede(usuario: UsuarioVisible | null, permiso: string): boolean {
  return usuario?.permisos.includes(permiso) ?? false;
}

/**
 * Exige que haya alguien con sesión abierta. Si no, va a la pantalla de ingreso.
 *
 * Se usa en cada pantalla y en cada Server Action, no solo en `proxy.ts`. El proxy
 * hace un filtro barato mirando si la cookie existe; la verificación de verdad va
 * lo más cerca posible del dato, porque una Server Action es alcanzable por POST
 * directo sin pasar por ninguna pantalla.
 */
export async function requerirUsuario(): Promise<UsuarioVisible> {
  const sesion = await sesionActual();

  if (!sesion) redirect("/ingresar");

  return sesion.usuario;
}

/**
 * Exige un permiso puntual. Devuelve el usuario para que quien llama pueda
 * registrarlo como autor sin volver a consultarlo.
 */
export async function requerirPermiso(permiso: string): Promise<UsuarioVisible> {
  const usuario = await requerirUsuario();

  if (!puede(usuario, permiso)) {
    redirect(`/sin-permiso?permiso=${encodeURIComponent(permiso)}`);
  }

  return usuario;
}

/**
 * Versión para Server Actions.
 *
 * Tira `ErrorDominio` en vez de redirigir: una acción que redirige en respuesta a
 * un POST deja al operador mirando otra pantalla sin entender qué pasó con lo que
 * acababa de cargar. Un mensaje arriba del formulario dice más.
 */
export async function exigirPermiso(permiso: string): Promise<UsuarioVisible> {
  const sesion = await sesionActual();

  if (!sesion) {
    throw errorDominio(
      "SESION_INVALIDA",
      "Se cerró la sesión. Volvé a entrar y cargalo de nuevo.",
    );
  }

  if (!puede(sesion.usuario, permiso)) {
    throw errorDominio(
      "PERMISO_DENEGADO",
      `Tu usuario no tiene permiso para "${etiquetaPermiso(permiso)}". ` +
        "Pedíselo a un administrador.",
    );
  }

  return sesion.usuario;
}

/**
 * Primera sección que esta persona puede ver.
 *
 * Es a dónde se la manda después de entrar: un empleado sin acceso a caja no
 * puede aterrizar en `/caja`. Devuelve `null` si no puede ver nada, que es un
 * usuario mal configurado y hay que decírselo en vez de dejarlo rebotando entre
 * redirecciones.
 */
export function primeraSeccionVisible(usuario: UsuarioVisible): string | null {
  const seccion = SECCIONES.find((s) => puede(usuario, `${s.clave}.ver`));

  return seccion?.ruta ?? null;
}
