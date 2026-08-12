/**
 * Los campos `@db.Date` de Postgres guardan una fecha sin hora, pero Prisma los
 * lleva y trae como `Date` de JavaScript, que siempre tiene hora y zona.
 *
 * Esto importa de verdad acá: la verdulería está en Argentina (UTC−3). Un turno
 * abierto a las 21:00 del 11 de agosto es, en UTC, el 12 de agosto a las 00:00.
 * Si se guardara el `Date` crudo, el turno de la tarde aparecería con fecha del
 * día siguiente y los reportes por día darían mal justo en el turno tarde.
 *
 * Convención: toda fecha-sin-hora viaja como medianoche UTC del día calendario
 * LOCAL. Prisma devuelve los `@db.Date` ya en esa forma.
 */

/**
 * Normaliza una fecha con hora (típicamente `new Date()` o algo que tipeó el
 * operador) al día calendario local, a medianoche UTC.
 *
 * OJO: es solo para fechas de entrada. Aplicarla a un valor que vino de la base
 * lo corre un día hacia atrás — ese valor ya es medianoche UTC, y leerlo con
 * `getDate()` en UTC−3 devuelve el día anterior a las 21:00. Para comparar
 * fechas de la base entre sí, usar `esMismoDia`.
 */
export function soloFecha(fecha: Date = new Date()): Date {
  return new Date(
    Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
  );
}

/** Formato ISO corto (YYYY-MM-DD), para mensajes de error. */
export function formatearFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Compara dos fechas ya normalizadas (o leídas de un `@db.Date`). */
export function esMismoDia(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** ¿`a` es anterior, en días, a `b`? Ambas normalizadas. */
export function esDiaAnterior(a: Date, b: Date): boolean {
  return (
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) <
    Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())
  );
}
