import { Prisma } from "@/generated/prisma/client";

export type Decimal = Prisma.Decimal;

/**
 * Cantidad de decimales de todo monto del sistema: ninguno. La moneda es el peso
 * argentino y no se usan centavos (ver AGENTS.md). Coincide con NUMERIC(14,0).
 */
export const ESCALA_MONTO = 0;

/**
 * Hacia abajo, siempre. Cuando el descuento por porcentaje no da un peso justo, el
 * resto va a favor de la verdulería, que es la que pone la plata: paga de menos,
 * nunca de más.
 *
 * Si esto cambia, cambia SOLO acá. Por eso `cheque.monto_pagado` y `cheque.ahorro`
 * se guardan en la base en lugar de recalcularse: los históricos no se mueven.
 */
const MODO_REDONDEO = Prisma.Decimal.ROUND_DOWN;

/**
 * Construye un Decimal.
 *
 * Para montos, pasar SIEMPRE string: `dec("1234")`. Un literal `number` ya pasó
 * por punto flotante antes de llegar acá, que es exactamente lo que §7.1 prohíbe.
 * Se acepta `number` solo por comodidad con enteros chicos (0, 1, 100).
 */
export function dec(valor: string | number | Decimal): Decimal {
  return new Prisma.Decimal(valor);
}

export const CERO = dec(0);

/** Redondea a la escala de monto del sistema. */
export function redondearMonto(valor: Decimal): Decimal {
  return valor.toDecimalPlaces(ESCALA_MONTO, MODO_REDONDEO);
}

export function sumar(valores: readonly Decimal[]): Decimal {
  return valores.reduce<Decimal>((acc, v) => acc.plus(v), CERO);
}

export function esPositivo(valor: Decimal): boolean {
  return valor.greaterThan(CERO);
}

/** Formatea para mensajes de error. No es formato de UI. */
export function formatearMonto(valor: Decimal): string {
  return valor.toFixed(ESCALA_MONTO);
}
