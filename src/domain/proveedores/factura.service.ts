import { prisma } from "@/lib/prisma";
import { CERO, esPositivo, type Decimal } from "@/lib/decimal";
import { errorDominio } from "@/lib/errores";
import { soloFecha } from "@/lib/fecha";
import { estadoSegunSaldo } from "./imputacion";

export interface DatosFacturaProveedor {
  proveedorId: string;
  numero: string;
  montoTotal: Decimal;
  fecha?: Date;
  fechaVencimiento?: Date | null;
}

/**
 * Alta de factura de proveedor.
 *
 * Acá se cierra el circuito del saldo a favor (§3.3): si el proveedor quedó con
 * saldo negativo —porque se le entregó un cheque de nominal mayor a lo imputado—,
 * ese crédito se descuenta automáticamente de la factura nueva.
 *
 * La factura puede nacer `parcial` o incluso `pagada`, sin que exista ningún pago
 * asociado a ella. No es una anomalía: el pago ya ocurrió antes, cuando se entregó
 * el cheque por más de lo que se debía.
 *
 * Va en transacción: toca la factura y el saldo del proveedor.
 */
export async function crearFacturaProveedor(datos: DatosFacturaProveedor) {
  if (!esPositivo(datos.montoTotal)) {
    throw errorDominio("MONTO_INVALIDO", "El monto de la factura tiene que ser mayor a cero.");
  }

  return prisma.$transaction(async (tx) => {
    const proveedor = await tx.proveedor.findUnique({ where: { id: datos.proveedorId } });

    if (!proveedor) {
      throw errorDominio(
        "PROVEEDOR_NO_ENCONTRADO",
        `No existe el proveedor ${datos.proveedorId}.`,
      );
    }

    // Solo hay crédito para aplicar si el saldo está en negativo. Un saldo positivo
    // es deuda de facturas anteriores y no descuenta nada de esta.
    const creditoDisponible = proveedor.saldo.isNegative() ? proveedor.saldo.abs() : CERO;
    const creditoAplicado = creditoDisponible.greaterThan(datos.montoTotal)
      ? datos.montoTotal
      : creditoDisponible;

    const saldoPendiente = datos.montoTotal.minus(creditoAplicado);

    const factura = await tx.facturaProveedor.create({
      data: {
        proveedorId: proveedor.id,
        numero: datos.numero,
        fecha: soloFecha(datos.fecha),
        fechaVencimiento: datos.fechaVencimiento
          ? soloFecha(datos.fechaVencimiento)
          : null,
        montoTotal: datos.montoTotal,
        saldoPendiente,
        estado: estadoSegunSaldo(datos.montoTotal, saldoPendiente),
      },
    });

    // El saldo sube por el total facturado. Si venía negativo, esta suma ya
    // consume el crédito: no hay que restarlo aparte.
    const proveedorActualizado = await tx.proveedor.update({
      where: { id: proveedor.id },
      data: { saldo: proveedor.saldo.plus(datos.montoTotal) },
    });

    return { factura, proveedor: proveedorActualizado, creditoAplicado };
  });
}

export async function facturasPendientes(proveedorId: string) {
  return prisma.facturaProveedor.findMany({
    where: { proveedorId, estado: { in: ["pendiente", "parcial"] } },
    orderBy: [{ fechaVencimiento: "asc" }, { fecha: "asc" }],
  });
}
