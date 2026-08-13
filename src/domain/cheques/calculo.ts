import { dec, ESCALA_MONTO, type Decimal } from "@/lib/decimal";
import { errorDominio } from "@/lib/errores";
import { aEnteroEscalado, deEnteroEscalado } from "@/lib/monto-texto";
import { calcularEnPesos } from "./calculo-puro";

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

  // Se rechaza en vez de truncar. Un nominal con centavos significa que algo aguas
  // arriba dejó pasar un decimal, y quedarse con la parte entera lo taparía: el
  // cheque se guardaría por un monto distinto del que está escrito en el papel.
  if (!nominal.isInteger()) {
    throw errorDominio(
      "MONTO_INVALIDO",
      `El nominal va en pesos enteros, sin centavos; se recibió ${nominal.toString()}.`,
    );
  }

  // 100 % de descuento significaría un cheque regalado: no es un descuento, y
  // dejaría monto_pagado en cero. Se rechaza igual que un porcentaje absurdo.
  if (porcentajeDescuento.isNegative() || porcentajeDescuento.greaterThanOrEqualTo(100)) {
    throw errorDominio(
      "PORCENTAJE_INVALIDO",
      `El descuento tiene que estar entre 0 y 100 (sin incluir); se recibió ${porcentajeDescuento.toString()}.`,
    );
  }

  const calculo = calcularEnPesos(
    aEnteroEscalado(nominal.toFixed(ESCALA_MONTO), ESCALA_MONTO),
    aEnteroEscalado(porcentajeDescuento.toFixed(ESCALA_PORCENTAJE), ESCALA_PORCENTAJE),
  );

  // Sin centavos, un nominal chico con un descuento grande puede dar cero: $10 al
  // 95 % son $0,50, y el piso lo deja en $0. Un cheque que no se pagó no es una
  // compra, y el CHECK `monto_pagado > 0` de la base lo rechazaría con un error
  // que el operador no podría interpretar. Mejor frenarlo acá y explicarlo.
  if (calculo.montoPagado <= 0n) {
    throw errorDominio(
      "MONTO_INVALIDO",
      `Un nominal de ${nominal.toString()} al ${porcentajeDescuento.toString()} % da menos de $1. ` +
        "Revisá el nominal o el descuento.",
    );
  }

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
