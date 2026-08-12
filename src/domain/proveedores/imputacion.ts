import type { PrismaTx } from "@/lib/prisma";
import { esPositivo, formatearMonto, sumar, type Decimal } from "@/lib/decimal";
import { errorDominio } from "@/lib/errores";
import type { EstadoFactura } from "@/generated/prisma/enums";

/** Una factura del proveedor y cuánto se le imputa de este cheque o pago. */
export interface ImputacionSolicitada {
  facturaProveedorId: string;
  monto: Decimal;
}

/**
 * El estado de una factura se deduce siempre del saldo: nunca se decide a mano.
 * La base tiene un CHECK que rechaza cualquier combinación que se contradiga.
 */
export function estadoSegunSaldo(montoTotal: Decimal, saldoPendiente: Decimal): EstadoFactura {
  if (saldoPendiente.isZero()) return "pagada";
  if (saldoPendiente.equals(montoTotal)) return "pendiente";
  return "parcial";
}

/**
 * Valida un conjunto de imputaciones contra las facturas reales y contra el tope
 * del instrumento que las paga (el nominal del cheque, o el monto del pago).
 *
 * Se usa igual en la entrega de cheque (§4.3) y en el pago en efectivo (§4.5):
 * es literalmente "el mismo flujo de imputación a facturas" del que habla §4.5.
 *
 * Devuelve el total imputado para que quien llama no lo recalcule.
 */
export async function validarImputaciones(
  tx: PrismaTx,
  opciones: {
    proveedorId: string;
    imputaciones: readonly ImputacionSolicitada[];
    /** Nominal del cheque o monto del pago. */
    tope: Decimal;
    /** Código de error si el total supera el tope: distingue cheque de pago. */
    codigoExceso: "IMPUTACION_SUPERA_NOMINAL" | "IMPUTACION_SUPERA_PAGO";
    nombreTope: string;
  },
): Promise<Decimal> {
  const { proveedorId, imputaciones, tope, codigoExceso, nombreTope } = opciones;

  const idsRepetidos = new Set<string>();
  for (const imputacion of imputaciones) {
    if (idsRepetidos.has(imputacion.facturaProveedorId)) {
      throw errorDominio(
        "IMPUTACION_DUPLICADA",
        `La factura ${imputacion.facturaProveedorId} aparece dos veces. ` +
          "Sumá los montos en una sola imputación.",
      );
    }
    idsRepetidos.add(imputacion.facturaProveedorId);

    if (!esPositivo(imputacion.monto)) {
      throw errorDominio(
        "MONTO_INVALIDO",
        `El monto imputado a la factura ${imputacion.facturaProveedorId} tiene que ser positivo.`,
      );
    }
  }

  const total = sumar(imputaciones.map((i) => i.monto));

  // §4.3, validación clave: nunca puede imputarse más que el valor del cheque.
  if (total.greaterThan(tope)) {
    throw errorDominio(
      codigoExceso,
      `La suma de imputaciones (${formatearMonto(total)}) supera ${nombreTope} ` +
        `(${formatearMonto(tope)}).`,
    );
  }

  const facturas = await tx.facturaProveedor.findMany({
    where: { id: { in: [...idsRepetidos] } },
  });
  const porId = new Map(facturas.map((f) => [f.id, f]));

  for (const imputacion of imputaciones) {
    const factura = porId.get(imputacion.facturaProveedorId);

    if (!factura) {
      throw errorDominio(
        "FACTURA_NO_ENCONTRADA",
        `No existe la factura ${imputacion.facturaProveedorId}.`,
      );
    }

    if (factura.proveedorId !== proveedorId) {
      throw errorDominio(
        "FACTURA_DE_OTRO_PROVEEDOR",
        `La factura ${factura.numero} no es del proveedor al que se está pagando.`,
      );
    }

    if (factura.saldoPendiente.isZero()) {
      throw errorDominio(
        "FACTURA_YA_PAGADA",
        `La factura ${factura.numero} ya está saldada.`,
      );
    }

    if (imputacion.monto.greaterThan(factura.saldoPendiente)) {
      throw errorDominio(
        "IMPUTACION_SUPERA_SALDO_FACTURA",
        `Se quiere imputar ${formatearMonto(imputacion.monto)} a la factura ${factura.numero}, ` +
          `que debe ${formatearMonto(factura.saldoPendiente)}. ` +
          "El excedente va a saldo a favor del proveedor, no a la factura.",
      );
    }
  }

  return total;
}

/**
 * Descuenta cada imputación del saldo de su factura y recalcula el estado.
 *
 * Asume que `validarImputaciones` ya corrió sobre las mismas filas dentro de la
 * misma transacción.
 */
export async function aplicarImputacionesAFacturas(
  tx: PrismaTx,
  imputaciones: readonly ImputacionSolicitada[],
): Promise<void> {
  for (const imputacion of imputaciones) {
    const factura = await tx.facturaProveedor.findUniqueOrThrow({
      where: { id: imputacion.facturaProveedorId },
    });

    const saldoPendiente = factura.saldoPendiente.minus(imputacion.monto);

    await tx.facturaProveedor.update({
      where: { id: factura.id },
      data: {
        saldoPendiente,
        estado: estadoSegunSaldo(factura.montoTotal, saldoPendiente),
      },
    });
  }
}
