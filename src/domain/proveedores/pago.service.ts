import { prisma } from "@/lib/prisma";
import { esPositivo, type Decimal } from "@/lib/decimal";
import { errorDominio } from "@/lib/errores";
import { registrarMovimientoCaja } from "@/domain/caja/movimiento.service";
import {
  aplicarImputacionesAFacturas,
  validarImputaciones,
  type ImputacionSolicitada,
} from "./imputacion";

export interface DatosPagoEfectivo {
  proveedorId: string;
  monto: Decimal;
  imputaciones: readonly ImputacionSolicitada[];
  fecha?: Date;
  observacion?: string | null;
  /** Por defecto se asocia al turno abierto. `null` lo deja fuera de turno. */
  turnoId?: string | null;
}

/**
 * Pago a proveedor en efectivo (§4.5).
 *
 * Es el mismo flujo de imputación que la entrega de cheque, con dos diferencias:
 *
 * - **Sí genera movimiento de la Bolsa Grande**, tipo egreso, categoría "Pago a
 *   proveedor en efectivo". Acá sale plata de verdad.
 * - **No hay ahorro.** Se paga lo que se debe, peso por peso.
 *
 * Igual que en la entrega, el saldo del proveedor baja por el monto completo del
 * pago: si se paga de más, el excedente queda como saldo a favor.
 *
 * TODO: §3.3 prevé `medio = 'transferencia'`, pero §4.5 solo describe el efectivo.
 *   Una transferencia no sale de la Bolsa Grande —es dinero bancario— así que
 *   registrarla acá cargaría un egreso de efectivo que nunca ocurrió. Hace falta
 *   definir con el dueño si llevan control de la cuenta bancaria antes de
 *   implementarlo.
 */
export async function pagarProveedorEnEfectivo(datos: DatosPagoEfectivo) {
  if (!esPositivo(datos.monto)) {
    throw errorDominio("MONTO_INVALIDO", "El monto del pago tiene que ser mayor a cero.");
  }

  const fecha = datos.fecha ?? new Date();

  return prisma.$transaction(async (tx) => {
    const proveedor = await tx.proveedor.findUnique({ where: { id: datos.proveedorId } });

    if (!proveedor) {
      throw errorDominio(
        "PROVEEDOR_NO_ENCONTRADO",
        `No existe el proveedor ${datos.proveedorId}.`,
      );
    }

    if (!proveedor.activo) {
      throw errorDominio(
        "PROVEEDOR_INACTIVO",
        `El proveedor ${proveedor.nombre} está dado de baja.`,
      );
    }

    await validarImputaciones(tx, {
      proveedorId: proveedor.id,
      imputaciones: datos.imputaciones,
      tope: datos.monto,
      codigoExceso: "IMPUTACION_SUPERA_PAGO",
      nombreTope: "el monto del pago",
    });

    const pago = await tx.pagoProveedor.create({
      data: {
        proveedorId: proveedor.id,
        fecha,
        medio: "efectivo",
        monto: datos.monto,
        observacion: datos.observacion ?? null,
      },
    });

    if (datos.imputaciones.length > 0) {
      await tx.imputacionPago.createMany({
        data: datos.imputaciones.map((imputacion) => ({
          pagoProveedorId: pago.id,
          facturaProveedorId: imputacion.facturaProveedorId,
          montoImputado: imputacion.monto,
        })),
      });
    }

    await aplicarImputacionesAFacturas(tx, datos.imputaciones);

    const proveedorActualizado = await tx.proveedor.update({
      where: { id: proveedor.id },
      data: { saldo: proveedor.saldo.minus(datos.monto) },
    });

    const movimiento = await registrarMovimientoCaja(tx, {
      categoriaSlug: "pago_proveedor_efectivo",
      monto: datos.monto,
      referenciaTipo: "pago_proveedor",
      referenciaId: pago.id,
      turnoId: datos.turnoId,
      fecha,
      observacion: datos.observacion ?? `Pago a ${proveedor.nombre}`,
    });

    return { pago, movimiento, proveedor: proveedorActualizado };
  });
}
