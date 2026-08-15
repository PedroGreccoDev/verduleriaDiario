/**
 * Rangos de fechas para el reporte de §5.1.
 *
 * Módulo puro, sin base de datos. Todo rango es **semiabierto**: `[desde, hasta)`,
 * con `hasta` en la medianoche del día SIGUIENTE al último del período. No es un
 * detalle de estilo — `movimiento_caja.fecha` guarda hora, así que un rango cerrado
 * en la medianoche del último día dejaría afuera todo lo que pasó ese día después
 * de las 00:00, que es prácticamente todo. El turno tarde entero desaparecería del
 * reporte del día.
 *
 * Los cortes se calculan con los getters locales (`getFullYear`, `getMonth`,
 * `getDate`), igual que `soloFecha` y `calendario.ts`: el día que le importa a la
 * verdulería es el suyo, no el de UTC.
 */

export const PRESETS = ["dia", "semana", "mes", "anio", "personalizado"] as const;

export type Preset = (typeof PRESETS)[number];

export interface Periodo {
  /** Inclusive. */
  desde: Date;
  /** EXCLUSIVO: medianoche del día siguiente al último del período. */
  hasta: Date;
}

export function esPreset(valor: string): valor is Preset {
  return (PRESETS as readonly string[]).includes(valor);
}

/** Medianoche local del día de `fecha`. */
function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);
}

/**
 * El período que corresponde al preset, tomando `referencia` como el día elegido.
 *
 * `personalizado` no tiene forma canónica —lo definen las dos fechas que tipea el
 * operador— así que cae al día de la referencia; la pantalla usa
 * `periodoPersonalizado` para ese caso.
 */
export function periodoDe(preset: Preset, referencia: Date = new Date()): Periodo {
  const dia = inicioDelDia(referencia);

  switch (preset) {
    case "semana": {
      // La semana de la verdulería arranca el lunes. getDay() da 0 para domingo,
      // que acá es el ÚLTIMO día y no el primero.
      const diaDeSemana = dia.getDay();
      const desdeElLunes = diaDeSemana === 0 ? 6 : diaDeSemana - 1;
      const lunes = sumarDias(dia, -desdeElLunes);

      return { desde: lunes, hasta: sumarDias(lunes, 7) };
    }

    case "mes":
      return {
        desde: new Date(dia.getFullYear(), dia.getMonth(), 1),
        hasta: new Date(dia.getFullYear(), dia.getMonth() + 1, 1),
      };

    case "anio":
      return {
        desde: new Date(dia.getFullYear(), 0, 1),
        hasta: new Date(dia.getFullYear() + 1, 0, 1),
      };

    case "dia":
    case "personalizado":
      return { desde: dia, hasta: sumarDias(dia, 1) };
  }
}

/**
 * Rango a partir de dos `<input type="date">` ("2026-08-14"), ambos inclusive para
 * el operador: pedir del 1 al 14 tiene que incluir el 14 entero.
 *
 * Devuelve `null` si alguna fecha no se entiende o si el rango está al revés. Que
 * el desde sea posterior al hasta no se corrige dando vuelta las fechas: se avisa,
 * porque quien lo escribió quiso decir otra cosa y un reporte vacío o invertido en
 * silencio es peor que un error.
 */
export function periodoPersonalizado(desde: string, hasta: string): Periodo | null {
  const inicio = fechaDeTexto(desde);
  const fin = fechaDeTexto(hasta);

  if (inicio === null || fin === null) return null;
  if (inicio.getTime() > fin.getTime()) return null;

  return { desde: inicio, hasta: sumarDias(fin, 1) };
}

/** "2026-08-14" → medianoche local de ese día. `null` si no es una fecha así. */
function fechaDeTexto(texto: string): Date | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto.trim());
  if (!partes) return null;

  const [, año, mes, dia] = partes;
  const fecha = new Date(Number(año), Number(mes) - 1, Number(dia));

  // Un 31 de febrero construye un Date válido que cae en marzo. Comparar contra lo
  // que se pidió es la forma de detectarlo.
  return fecha.getMonth() === Number(mes) - 1 && fecha.getDate() === Number(dia)
    ? fecha
    : null;
}

/** El último día INCLUIDO en el período, para mostrarlo sin confundir al operador. */
export function ultimoDiaIncluido(periodo: Periodo): Date {
  return sumarDias(periodo.hasta, -1);
}
