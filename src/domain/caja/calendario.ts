/**
 * Qué turnos corresponden a cada día.
 *
 * De lunes a sábado son dos: mañana y tarde. Los domingos y feriados, uno solo.
 * Resuelve parcialmente §8.4.
 *
 * Es una SUGERENCIA, no una regla que el sistema imponga. Dos motivos:
 *
 * 1. El sistema no sabe qué días son feriados, y no queremos que lo sepa: el
 *    calendario argentino cambia todos los años y habría que mantenerlo. Como la
 *    regla no bloquea, un feriado se maneja solo — la pantalla propone dos turnos,
 *    el operador abre uno y listo.
 *
 * 2. Un día atípico existe. Si un domingo excepcional abren dos turnos, el sistema
 *    tiene que poder registrarlo. Un sistema que obliga a mentir sobre lo que pasó
 *    es peor que uno que sugiere y se deja corregir.
 */

export const TURNO_MAÑANA = "mañana";
export const TURNO_TARDE = "tarde";
/** Domingos y feriados. Nombre propio, y no "mañana" reutilizado, para que un
 *  reporte por turno no muestre un domingo como si hubieran olvidado la tarde. */
export const TURNO_UNICO = "único";

export const NOMBRES_TURNO = [TURNO_MAÑANA, TURNO_TARDE, TURNO_UNICO] as const;

export type NombreTurno = (typeof NOMBRES_TURNO)[number];

/** Los turnos habituales de ese día, en orden. */
export function turnosSugeridos(fecha: Date = new Date()): NombreTurno[] {
  return esDomingo(fecha) ? [TURNO_UNICO] : [TURNO_MAÑANA, TURNO_TARDE];
}

/**
 * El turno que toca abrir, dado lo que ya se abrió ese día.
 *
 * Devuelve `null` cuando ya se abrieron todos los sugeridos: ahí la pantalla no
 * propone nada, pero deja elegir igual (día atípico o feriado).
 */
export function proximoTurnoSugerido(
  fecha: Date,
  nombresYaAbiertos: readonly string[],
): NombreTurno | null {
  const pendientes = turnosSugeridos(fecha).filter(
    (nombre) => !nombresYaAbiertos.includes(nombre),
  );

  return pendientes[0] ?? null;
}

/**
 * getDay() usa la hora local, que es lo correcto acá: el domingo que importa es
 * el de la verdulería, no el de UTC.
 */
function esDomingo(fecha: Date): boolean {
  return fecha.getDay() === 0;
}

export function esNombreDeTurnoConocido(nombre: string): nombre is NombreTurno {
  return (NOMBRES_TURNO as readonly string[]).includes(nombre);
}
