import type { Decimal } from "./decimal";

/**
 * Formateo de montos para pantalla, en formato argentino: punto para los miles y
 * coma para los decimales.
 *
 * Se arma a partir del string del Decimal y no convirtiendo a `number`. Pasar por
 * `Number` reintroduciría el punto flotante justo en el borde donde §7.1 dice que
 * no lo usemos — con montos grandes empezaría a redondear mal el último centavo.
 */
export function formatearPesos(monto: Decimal): string {
  const negativo = monto.isNegative();
  const [enteros, decimales] = monto.abs().toFixed(2).split(".");
  const conMiles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${negativo ? "-" : ""}$ ${conMiles},${decimales}`;
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

export function formatearFechaLarga(fecha: Date): string {
  return FECHA_LARGA.format(fecha);
}
