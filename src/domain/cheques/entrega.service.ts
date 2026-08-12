import { prisma } from "@/lib/prisma";
import { errorDominio } from "@/lib/errores";
import {
  aplicarImputacionesAFacturas,
  validarImputaciones,
  type ImputacionSolicitada,
} from "@/domain/proveedores/imputacion";

export interface DatosEntregaCheque {
  chequeId: string;
  proveedorId: string;
  /**
   * Puede venir vacío: entregar un cheque sin imputar a ninguna factura es un
   * adelanto, y todo el nominal queda como saldo a favor del proveedor.
   */
  imputaciones: readonly ImputacionSolicitada[];
  fechaEntrega?: Date;
}

/**
 * Entrega de cheque a proveedor (§4.3). Es el flujo más delicado del módulo.
 *
 * Toca cinco tablas y por eso va entero en una transacción (§7.1):
 *   1. cheque              → pasa a `entregado`, sale de la cartera
 *   2. imputacion_cheque   → una fila por factura cubierta
 *   3. factura_proveedor   → baja el saldo pendiente de cada una
 *   4. proveedor           → baja el saldo por el NOMINAL COMPLETO
 *   5. pago_proveedor      → queda el pago con medio = cheque
 *
 * Dos cosas que NO pasa acá, y son deliberadas:
 *
 * - **No genera movimiento de la Bolsa Grande.** No hay efectivo involucrado: la
 *   plata salió cuando se compró el cheque (§4.2). Un egreso acá sería contar el
 *   mismo gasto dos veces.
 *
 * - **No escribe el ahorro en ningún lado.** El ahorro realizado se deriva de los
 *   cheques entregados, sumando `cheque.ahorro` por `fecha_entrega`
 *   (ver `cartera.ts`). Al no existir como registro, es estructuralmente imposible
 *   que se cuele en el reporte de caja.
 *
 * Sobre el punto 4: el saldo del proveedor baja por el nominal completo, no por lo
 * imputado. Si el nominal supera la deuda, el excedente deja el saldo en negativo
 * —saldo a favor— y se descuenta solo de la próxima factura. No hay rama especial
 * para ese caso: es la misma resta (§3.3).
 */
export async function entregarCheque(datos: DatosEntregaCheque) {
  const fechaEntrega = datos.fechaEntrega ?? new Date();

  return prisma.$transaction(async (tx) => {
    const cheque = await tx.cheque.findUnique({ where: { id: datos.chequeId } });

    if (!cheque) {
      throw errorDominio("CHEQUE_NO_ENCONTRADO", `No existe el cheque ${datos.chequeId}.`);
    }

    if (cheque.estado !== "en_cartera") {
      throw errorDominio(
        "CHEQUE_FUERA_DE_CARTERA",
        `El cheque ${cheque.banco} ${cheque.numero} está en estado "${cheque.estado}" ` +
          "y ya no está en cartera.",
      );
    }

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
      tope: cheque.nominal,
      codigoExceso: "IMPUTACION_SUPERA_NOMINAL",
      nombreTope: "el nominal del cheque",
    });

    // 1. El cheque sale de la cartera.
    const chequeEntregado = await tx.cheque.update({
      where: { id: cheque.id },
      data: {
        estado: "entregado",
        fechaEntrega,
        proveedorDestinoId: proveedor.id,
      },
    });

    // 2. Las imputaciones, que son lo que permite que un cheque cubra varias
    //    facturas. Por esto no hay un factura_id en `cheque` (§3.2).
    if (datos.imputaciones.length > 0) {
      await tx.imputacionCheque.createMany({
        data: datos.imputaciones.map((imputacion) => ({
          chequeId: cheque.id,
          facturaProveedorId: imputacion.facturaProveedorId,
          montoImputado: imputacion.monto,
        })),
      });
    }

    // 3. Baja el saldo de cada factura.
    await aplicarImputacionesAFacturas(tx, datos.imputaciones);

    // 4. Baja el saldo del proveedor por el nominal completo.
    const proveedorActualizado = await tx.proveedor.update({
      where: { id: proveedor.id },
      data: { saldo: proveedor.saldo.minus(cheque.nominal) },
    });

    // 5. El pago, con medio = cheque. `monto` es el nominal: es lo que el cheque
    //    cancela, no lo que costó comprarlo.
    const pago = await tx.pagoProveedor.create({
      data: {
        proveedorId: proveedor.id,
        fecha: fechaEntrega,
        medio: "cheque",
        monto: cheque.nominal,
        chequeId: cheque.id,
        observacion: `Cheque ${cheque.banco} ${cheque.numero}`,
      },
    });

    return {
      cheque: chequeEntregado,
      pago,
      proveedor: proveedorActualizado,
      /** Ahorro que se realiza con esta entrega, imputado a `fechaEntrega` (§6). */
      ahorroRealizado: chequeEntregado.ahorro,
    };
  });
}
