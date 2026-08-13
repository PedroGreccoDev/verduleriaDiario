import { dec, type Decimal } from "@/lib/decimal";
import { errorDominio } from "@/lib/errores";
import { aEnteroEscalado, deEnteroEscalado } from "@/lib/monto-texto";
import { calcularEnCentavos } from "./calculo-puro";

/**
 * El operador tipea nominal y porcentaje; el sistema calcula el monto pagado y lo
 * muestra en pantalla para que lo verifique antes de confirmar (§4.2, §6).
 *
 * Ejemplo del dueño: nominal $1.000 con 10 % de descuento → se paga $900 y el
 * ahorro es $100. Ese ahorro NO es plata que entra: es cancelar $1.000 de deuda
 * habiendo gastado $900 (§2.3).
 *
 * La cuenta en sí vive en `calculo-puro.ts`, en aritmética entera. Acá solo se
 * valida y se traduce a Decimal. Es la MISMA cuenta que hace el navegador para el
 * preview, y eso es a propósito: si fueran dos implementaciones, la pantalla de
 * confirmación podría mostrar un monto y guardarse otro.
 */

const ESCALA_MONTO = 2;
const ESCALA_PORCENTAJE = 2;

export interface CalculoCheque {
  nominal: Decimal;
  porcentajeDescuento: Decimal;
  montoPagado: Decimal;
  ahorro: Decimal;
}

export function calcularCheque(
  nominal: Decimal,
  porcentajeDescuento: Decimal,
): CalculoCheque {
  if (!nominal.greaterThan(0)) {
    throw errorDominio("MONTO_INVALIDO", "El nominal del cheque tiene que ser mayor a cero.");
  }

  // 100 % de descuento significaría un cheque regalado: no es un descuento, y
  // dejaría monto_pagado en cero. Se rechaza igual que un porcentaje absurdo.
  if (porcentajeDescuento.isNegative() || porcentajeDescuento.greaterThanOrEqualTo(100)) {
    throw errorDominio(
      "PORCENTAJE_INVALIDO",
      `El descuento tiene que estar entre 0 y 100 (sin incluir); se recibió ${porcentajeDescuento.toString()}.`,
    );
  }

  const calculo = calcularEnCentavos(
    aEnteroEscalado(nominal.toFixed(ESCALA_MONTO), ESCALA_MONTO),
    aEnteroEscalado(porcentajeDescuento.toFixed(ESCALA_PORCENTAJE), ESCALA_PORCENTAJE),
  );

  return {
    nominal,
    porcentajeDescuento,
    montoPagado: dec(deEnteroEscalado(calculo.montoPagado, ESCALA_MONTO)),
    ahorro: dec(deEnteroEscalado(calculo.ahorro, ESCALA_MONTO)),
  };
}

/** Para la pantalla de confirmación de §4.2, antes de que exista el cheque. */
export function previsualizarCompra(
  nominal: Decimal,
  porcentajeDescuento: Decimal,
): CalculoCheque {
  return calcularCheque(nominal, porcentajeDescuento);
}
