import {
  aEnteroEscalado,
  deEnteroEscalado,
  normalizarMontoTexto,
  normalizarPorcentajeTexto,
} from "@/lib/monto-texto";

/**
 * El cálculo del cheque, en aritmética entera y sin dependencias.
 *
 * Vive separado de `calculo.ts` (que trabaja con Prisma.Decimal y solo corre en
 * el servidor) porque la pantalla de compra tiene que mostrar el monto pagado
 * ANTES de confirmar, según §4.2. Si el navegador calculara el preview por su
 * cuenta y el servidor por la suya, podrían diferir en un centavo — y entonces la
 * pantalla que existe justamente para verificar estaría mintiendo.
 *
 * Una sola implementación, usada por los dos lados. `calculo.ts` la envuelve para
 * devolver Decimals; el componente del navegador la usa directamente.
 *
 * Todo en enteros escalados: los montos en centavos, el porcentaje en centésimas
 * de punto (12,5 % → 1250n). BigInt y no `number` porque nominal × 10000 supera
 * el entero seguro de JavaScript con montos grandes.
 */

const ESCALA_MONTO = 2;
const ESCALA_PORCENTAJE = 2;
/** 100 % expresado en centésimas de punto. */
const CIEN_POR_CIENTO = 10_000n;

export interface CalculoEnCentavos {
  nominal: bigint;
  porcentaje: bigint;
  montoPagado: bigint;
  ahorro: bigint;
}

export function calcularEnCentavos(
  nominalCentavos: bigint,
  porcentajeCentesimas: bigint,
): CalculoEnCentavos {
  const montoPagado = dividirRedondeandoHalfUp(
    nominalCentavos * (CIEN_POR_CIENTO - porcentajeCentesimas),
    CIEN_POR_CIENTO,
  );

  return {
    nominal: nominalCentavos,
    porcentaje: porcentajeCentesimas,
    montoPagado,
    // Derivado del pagado ya redondeado: así ahorro + pagado da siempre el
    // nominal exacto, que es lo que exige el CHECK de la base.
    ahorro: nominalCentavos - montoPagado,
  };
}

/** Half-up. Todos los valores acá son positivos, así que alcanza con sumar la mitad. */
function dividirRedondeandoHalfUp(numerador: bigint, divisor: bigint): bigint {
  return (numerador + divisor / 2n) / divisor;
}

export interface PrevisualizacionCompra {
  ok: boolean;
  /** Canónicos ("900.00"), listos para formatear. Solo si ok. */
  montoPagado?: string;
  ahorro?: string;
  motivo?: string;
}

/**
 * Lo que usa la pantalla de compra: toma el texto crudo de los campos y devuelve
 * lo que hay que mostrar, o por qué no se puede calcular todavía.
 */
export function previsualizarDesdeTexto(
  nominalTexto: string,
  porcentajeTexto: string,
): PrevisualizacionCompra {
  const nominal = normalizarMontoTexto(nominalTexto);
  if (!nominal) return { ok: false, motivo: "Ingresá el nominal del cheque." };

  const porcentaje = normalizarPorcentajeTexto(porcentajeTexto);
  if (!porcentaje) return { ok: false, motivo: "Ingresá el porcentaje de descuento." };

  const nominalCentavos = aEnteroEscalado(nominal, ESCALA_MONTO);
  if (nominalCentavos <= 0n) {
    return { ok: false, motivo: "El nominal tiene que ser mayor a cero." };
  }

  const porcentajeCentesimas = aEnteroEscalado(porcentaje, ESCALA_PORCENTAJE);
  if (porcentajeCentesimas >= CIEN_POR_CIENTO) {
    return { ok: false, motivo: "El descuento tiene que ser menor a 100 %." };
  }

  const calculo = calcularEnCentavos(nominalCentavos, porcentajeCentesimas);

  return {
    ok: true,
    montoPagado: deEnteroEscalado(calculo.montoPagado, ESCALA_MONTO),
    ahorro: deEnteroEscalado(calculo.ahorro, ESCALA_MONTO),
  };
}
