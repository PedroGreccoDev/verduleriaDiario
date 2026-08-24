import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { UsuarioVisible } from "./usuario.service";

/**
 * Sesiones guardadas en la base (§9).
 *
 * POR QUÉ NO UN TOKEN FIRMADO: con un JWT los permisos viajan adentro del token y
 * quedan congelados hasta que la persona vuelve a entrar. Como las sesiones de
 * este sistema no expiran —decisión del dueño—, "hasta que vuelva a entrar" puede
 * ser nunca: destildar un checkbox no tendría efecto en la práctica. Leyendo de la
 * base en cada request, un permiso sacado se siente en el próximo click, y además
 * se le puede cerrar la sesión a alguien desde la pantalla de usuarios.
 *
 * El costo es una consulta por request. En una PC de mostrador contra un Postgres
 * local, es ruido.
 */

/** 32 bytes al azar: no hay forma de adivinarlo ni de derivarlo del usuario. */
const BYTES_TOKEN = 32;

/**
 * En la base va el SHA-256, nunca el token. Sin esto, cualquiera con una copia de
 * la base —un backup, la PC prestada al técnico— arma la cookie de otro y entra.
 *
 * Un solo pasaje de SHA-256 alcanza, y no hace falta scrypt: esto no es una
 * contraseña que alguien eligió, es un valor aleatorio de 32 bytes. No hay
 * diccionario que probar.
 */
function hashearToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Devuelve el token en claro, que es lo único que va a la cookie. */
export async function abrirSesion(usuarioId: string): Promise<string> {
  const token = randomBytes(BYTES_TOKEN).toString("base64url");

  await prisma.sesionUsuario.create({
    data: { hashToken: hashearToken(token), usuarioId },
  });

  return token;
}

/**
 * Cada cuánto se refresca `ultimo_acceso`.
 *
 * Escribir en cada request convertiría toda navegación en una escritura. Cinco
 * minutos alcanzan de sobra para lo que este dato sirve: mirar la lista de
 * sesiones abiertas y saber cuál quedó olvidada.
 */
const MINUTOS_ENTRE_REFRESCOS = 5;

export interface SesionActiva {
  sesionId: string;
  usuario: UsuarioVisible;
}

/**
 * Resuelve el token de la cookie al usuario.
 *
 * Devuelve `null` —y no una excepción— para token inexistente, sesión borrada o
 * usuario desactivado: los tres significan lo mismo para quien llama, que hay que
 * mandar a la pantalla de ingreso.
 */
export async function usuarioDeSesion(token: string): Promise<SesionActiva | null> {
  const sesion = await prisma.sesionUsuario.findUnique({
    where: { hashToken: hashearToken(token) },
    include: { usuario: { include: { permisos: true } } },
  });

  if (!sesion) return null;

  // Un usuario desactivado mientras tenía la sesión abierta queda afuera en el
  // próximo request. `cambiarActivacion` ya le borra las sesiones; esto es el
  // cinturón por si alguna quedara viva.
  if (!sesion.usuario.activo) return null;

  const desdeUltimoAcceso = Date.now() - sesion.ultimoAcceso.getTime();
  if (desdeUltimoAcceso > MINUTOS_ENTRE_REFRESCOS * 60_000) {
    await prisma.sesionUsuario.update({
      where: { id: sesion.id },
      data: { ultimoAcceso: new Date() },
    });
  }

  return {
    sesionId: sesion.id,
    usuario: {
      id: sesion.usuario.id,
      nombre: sesion.usuario.nombre,
      usuario: sesion.usuario.usuario,
      rol: sesion.usuario.rol,
      activo: sesion.usuario.activo,
      debeCambiarContrasena: sesion.usuario.debeCambiarContrasena,
      creadoEn: sesion.usuario.creadoEn,
      permisos: sesion.usuario.permisos.map((p) => p.permiso),
    },
  };
}

/**
 * Cierra una sesión. `deleteMany` y no `delete` porque cerrar una sesión que ya
 * no existe —doble click en "Salir", cookie vieja— no es un error.
 */
export async function cerrarSesion(token: string): Promise<void> {
  await prisma.sesionUsuario.deleteMany({ where: { hashToken: hashearToken(token) } });
}

/** Todas las sesiones de una persona, para mostrarlas y poder cerrarlas. */
export async function sesionesDe(usuarioId: string) {
  return prisma.sesionUsuario.findMany({
    where: { usuarioId },
    orderBy: { ultimoAcceso: "desc" },
    select: { id: true, creadaEn: true, ultimoAcceso: true },
  });
}

export async function cerrarSesionesDe(usuarioId: string): Promise<number> {
  const { count } = await prisma.sesionUsuario.deleteMany({ where: { usuarioId } });
  return count;
}

/**
 * Cuántas sesiones abiertas tiene cada usuario, para la lista.
 *
 * Una sola consulta agrupada en vez de una por fila: la pantalla de usuarios
 * muestra el dato de todos a la vez y no hay razón para ir a la base N veces.
 * Los usuarios sin sesiones no vienen en el resultado, así que quien consulta usa
 * `?? 0`.
 */
export async function contarSesionesPorUsuario(): Promise<Map<string, number>> {
  const filas = await prisma.sesionUsuario.groupBy({
    by: ["usuarioId"],
    _count: { _all: true },
  });

  return new Map(filas.map((fila) => [fila.usuarioId, fila._count._all]));
}
