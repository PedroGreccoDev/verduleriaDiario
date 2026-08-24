import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "@/lib/sesion";

/**
 * Primer filtro de acceso (§9).
 *
 * En Next 16 esto se llama `proxy.ts`: la convención `middleware.ts` quedó
 * deprecada y renombrada. Misma funcionalidad, otro nombre de archivo y de export.
 *
 * ACÁ SOLO SE MIRA SI LA COOKIE EXISTE. No se consulta la base ni se resuelven
 * permisos, por dos razones:
 *
 *   1. El proxy corre en cada request, incluidas las que Next hace por adelantado
 *      al pasar el mouse por un enlace. Una consulta acá se multiplica por todo.
 *   2. Una cookie presente no prueba nada: puede estar vencida, revocada o ser
 *      inventada. Lo único que hace este filtro es evitarle a quien no inició
 *      sesión el viaje de ida y vuelta hasta la pantalla.
 *
 * La verificación que manda está en `requerirUsuario` y `exigirPermiso`, pegada al
 * dato, y corre igual en cada pantalla y en cada Server Action — que son
 * alcanzables por POST directo sin pasar nunca por acá.
 */

/** Rutas a las que se entra sin sesión, por definición. */
const RUTAS_PUBLICAS = ["/ingresar", "/primer-arranque"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (RUTAS_PUBLICAS.some((ruta) => pathname.startsWith(ruta))) {
    return NextResponse.next();
  }

  if (request.cookies.get(COOKIE_SESION)) {
    return NextResponse.next();
  }

  // A dónde quería ir, para devolverlo ahí después de que entre. Se guarda solo la
  // ruta y nunca los parámetros: en la URL de un reporte filtrado puede haber
  // datos del negocio, y esto termina en el historial del navegador.
  const destino = new URL("/ingresar", request.url);
  if (pathname !== "/") destino.searchParams.set("volver", pathname);

  return NextResponse.redirect(destino);
}

export const config = {
  // Sin matcher, el proxy corre también sobre el CSS, el JavaScript y las imágenes,
  // y la redirección a /ingresar dejaría la pantalla de ingreso sin estilos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
