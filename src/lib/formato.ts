import { ESCALA_MONTO, type Decimal } from "./decimal";

/**
 * Formateo de montos para pantalla, en formato argentino: punto para los miles y
 * sin parte decimal, porque la moneda no tiene centavos (AGENTS.md).
 *
 * Se arma a partir del string del Decimal y no convirtiendo a `number`. Pasar por
 * `Number` reintroduciría el punto flotante justo en el borde donde §7.1 dice que
 * no lo usemos — con montos grandes empezaría a redondear mal el último peso.
 */
export function formatearPesos(monto: Decimal): string {
  const negativo = monto.isNegative();
  const enteros = monto.abs().toFixed(ESCALA_MONTO);
  const conMiles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${negativo ? "-" : ""}$ ${conMiles}`;
}

const HORA = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const FECHA_LARGA = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC", // los `@db.Date` ya vienen como medianoche UTC del día local
});

export function formatearHora(fecha: Date): string {
  return HORA.format(fecha);
}

/**
 * Espera una fecha YA normalizada al día local: un `@db.Date` de la base, o el
 * resultado de `soloFecha()`. Pasarle un `new Date()` crudo muestra el día
 * siguiente durante el turno tarde, que es cuando en Argentina ya es otro día en
 * UTC. Para instantes con hora está `formatearHora`, que sí usa la zona local.
 */
export function formatearFechaLarga(fecha: Date): string {
  return FECHA_LARGA.format(fecha);
}
