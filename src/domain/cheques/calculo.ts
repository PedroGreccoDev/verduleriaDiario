import { dec, redondearMonto, type Decimal } from "@/lib/decimal";
import { errorDominio } from "@/lib/errores";

/**
 * El operador tipea nominal y porcentaje; el sistema calcula el monto pagado y
 * lo muestra en pantalla para que lo verifique antes de confirmar (§4.2, §6).
 *
 * Ejemplo del dueño: nominal $1.000 con 10% de descuento → se paga $900 y el
 * ahorro es $100. Ese ahorro NO es plata que entra: es cancelar $1.000 de deuda
 * habiendo gastado $900 (§2.3).
 */
export interface CalculoCheque {
  nominal: Decimal;
  porcentajeDescuento: Decimal;
  montoPagado: Decimal;
  ahorro: Decimal;
}

export function calcularCheque(nominal: Decimal, porcentajeDescuento: Decimal): CalculoCheque {
  if (!nominal.greaterThan(0)) {
    throw errorDominio("MONTO_INVALIDO", "El nominal del cheque tiene que ser mayor a cero.");
  }

  // 100% de descuento significaría un cheque regalado: no es un descuento, es otra
  // cosa, y dejaría monto_pagado en cero. Se rechaza igual que un porcentaje absurdo.
  if (porcentajeDescuento.isNegative() || porcentajeDescuento.greaterThanOrEqualTo(100)) {
    throw errorDominio(
      "PORCENTAJE_INVALIDO",
      `El descuento tiene que estar entre 0 y 100 (sin incluir); se recibió ${porcentajeDescuento.toString()}.`,
    );
  }

  const montoPagado = redondearMonto(
    nominal.mul(dec(1).minus(porcentajeDescuento.div(100))),
  );

  // El ahorro se deriva del monto pagado YA REDONDEADO, no de la fórmula original.
  // Si se calculara aparte, con ciertos porcentajes ahorro + pagado no daría el
  // nominal por un centavo, y el CHECK `ahorro = nominal - monto_pagado` lo
  // rechazaría. Además, un reporte donde las columnas no cierran es indefendible.
  const ahorro = nominal.minus(montoPagado);

  return { nominal, porcentajeDescuento, montoPagado, ahorro };
}

/**
 * Para la pantalla de confirmación de §4.2, antes de que exista el cheque.
 * No toca la base.
 */
export function previsualizarCompra(nominal: Decimal, porcentajeDescuento: Decimal): CalculoCheque {
  return calcularCheque(nominal, porcentajeDescuento);
}
