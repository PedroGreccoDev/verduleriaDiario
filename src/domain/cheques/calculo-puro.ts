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
 * cuenta y el servidor por la suya, podrían diferir en un peso — y entonces la
 * pantalla que existe justamente para verificar estaría mintiendo.
 *
 * Una sola implementación, usada por los dos lados. `calculo.ts` la envuelve para
 * devolver Decimals; el componente del navegador la usa directamente.
 *
 * Los montos son pesos enteros, sin centavos (AGENTS.md). El porcentaje sí lleva
 * decimales y va escalado en centésimas de punto (12,5 % → 1250n). BigInt y no
 * `number` porque nominal × 10000 supera el entero seguro de JavaScript con
 * montos grandes.
 */

const ESCALA_MONTO = 0;
const ESCALA_PORCENTAJE = 2;
/** 100 % expresado en centésimas de punto. */
const CIEN_POR_CIENTO = 10_000n;

export interface CalculoEnPesos {
  nominal: bigint;
  porcentaje: bigint;
  montoPagado: bigint;
  ahorro: bigint;
}

export function calcularEnPesos(
  nominalPesos: bigint,
  porcentajeCentesimas: bigint,
): CalculoEnPesos {
  const montoPagado = dividirHaciaAbajo(
    nominalPesos * (CIEN_POR_CIENTO - porcentajeCentesimas),
    CIEN_POR_CIENTO,
  );

  return {
    nominal: nominalPesos,
    porcentaje: porcentajeCentesimas,
    montoPagado,
    // Derivado del pagado ya redondeado: así ahorro + pagado da siempre el
    // nominal exacto, que es lo que exige el CHECK de la base.
    ahorro: nominalPesos - montoPagado,
  };
}

/**
 * División entera hacia abajo: el peso que sobra queda a favor de la verdulería,
 * que paga de menos y nunca de más. $1.000 al 3,33 % da $966, no $967.
 *
 * La división de BigInt ya trunca hacia cero, y acá todos los valores son
 * positivos (el nominal se valida > 0 y el porcentaje < 100 %), así que truncar y
 * ir hacia abajo son lo mismo.
 */
function dividirHaciaAbajo(numerador: bigint, divisor: bigint): bigint {
  return numerador / divisor;
}

export interface PrevisualizacionCompra {
  ok: boolean;
  /** Canónicos ("900"), listos para formatear. Solo si ok. */
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
  if (!nominal) {
    return {
      ok: false,
      motivo: nominalTexto.trim() === ""
        ? "Ingresá el nominal del cheque."
        : "El nominal va en pesos enteros, sin centavos.",
    };
  }

  const porcentaje = normalizarPorcentajeTexto(porcentajeTexto);
  if (!porcentaje) return { ok: false, motivo: "Ingresá el porcentaje de descuento." };

  const nominalPesos = aEnteroEscalado(nominal, ESCALA_MONTO);
  if (nominalPesos <= 0n) {
    return { ok: false, motivo: "El nominal tiene que ser mayor a cero." };
  }

  const porcentajeCentesimas = aEnteroEscalado(porcentaje, ESCALA_PORCENTAJE);
  if (porcentajeCentesimas >= CIEN_POR_CIENTO) {
    return { ok: false, motivo: "El descuento tiene que ser menor a 100 %." };
  }

  const calculo = calcularEnPesos(nominalPesos, porcentajeCentesimas);

  // Mismo borde que valida el servidor: sin centavos, un nominal chico con un
  // descuento grande se redondea a cero y eso no es una compra.
  if (calculo.montoPagado <= 0n) {
    return { ok: false, motivo: "Con ese descuento no se paga ni $1 por el cheque." };
  }

  return {
    ok: true,
    montoPagado: deEnteroEscalado(calculo.montoPagado, ESCALA_MONTO),
    ahorro: deEnteroEscalado(calculo.ahorro, ESCALA_MONTO),
  };
}
