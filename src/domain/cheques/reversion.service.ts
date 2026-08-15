import { prisma } from "@/lib/prisma";
import { errorDominio } from "@/lib/errores";
import { estadoSegunSaldo } from "@/domain/proveedores/imputacion";

export interface DatosReversionEntrega {
  chequeId: string;
}

/**
 * Deshacer una entrega de cheque que se cargó mal: el proveedor equivocado, el
 * cheque equivocado, los montos imputados a la factura que no era.
 *
 * NO ES PARA UN CHEQUE QUE REBOTÓ. Cuando un cheque entregado rebota, quien lo
 * vendió lo levanta pagándole directo al proveedor: la deuda con el proveedor no
 * se reabre, no hay egreso de caja y el ahorro sigue realizado (§4.4). Ese caso se
 * registra con `rechazarCheque` y no toca ningún saldo. Revertir la entrega ahí
 * sería reabrir una deuda que la financiera ya pagó, o sea reclamarle al proveedor
 * plata que no debe.
 *
 * La diferencia es qué se está corrigiendo: una entrega mal cargada nunca ocurrió
 * y hay que borrarla; una entrega que rebotó ocurrió de verdad y lo que cambia es
 * quién termina poniendo la plata.
 *
 * Deshace exactamente los cinco pasos de `entregarCheque`, en orden inverso y en
 * una sola transacción (§7.1). Si algo falla, no queda nada a medias.
 */
export async function revertirEntregaCheque(datos: DatosReversionEntrega) {
  return prisma.$transaction(async (tx) => {
    const cheque = await tx.cheque.findUnique({
      where: { id: datos.chequeId },
      include: { imputaciones: true },
    });

    if (!cheque) {
      throw errorDominio("CHEQUE_NO_ENCONTRADO", `No existe el cheque ${datos.chequeId}.`);
    }

    if (cheque.fechaEntrega === null || cheque.proveedorDestinoId === null) {
      throw errorDominio(
        "CHEQUE_SIN_ENTREGA",
        `El cheque ${cheque.banco} ${cheque.numero} no está entregado: no hay entrega que revertir.`,
      );
    }

    // Un cheque rechazado conserva su `fecha_entrega`, así que sin esta guarda se
    // podría revertir su entrega y quedaría en cartera con fecha de rechazo: un
    // cheque que rebotó, listo para entregárselo a otro proveedor. Además reabriría
    // una deuda que la financiera ya pagó (§4.4). Que rebotara PRUEBA que la
    // entrega ocurrió, y una entrega que ocurrió no se corrige, se registra.
    if (cheque.estado === "rechazado") {
      throw errorDominio(
        "CHEQUE_YA_RECHAZADO",
        `El cheque ${cheque.banco} ${cheque.numero} figura como rechazado, así que su entrega ` +
          "ocurrió de verdad y no se puede deshacer. Lo levanta quien te lo vendió (§4.4).",
      );
    }

    const proveedor = await tx.proveedor.findUniqueOrThrow({
      where: { id: cheque.proveedorDestinoId },
    });

    // 3'. Las facturas recuperan lo que esta entrega les había descontado.
    //
    // No hace falta verificar que el saldo devuelto quepa en el total, aunque la
    // factura haya recibido otros pagos después. Devolver esta imputación deja el
    // saldo en `monto_total − (suma de las imputaciones que siguen vigentes)`, que
    // por definición no puede pasarse del total. El CHECK
    // `saldo_pendiente <= monto_total` se cumple solo.
    for (const imputacion of cheque.imputaciones) {
      const factura = await tx.facturaProveedor.findUniqueOrThrow({
        where: { id: imputacion.facturaProveedorId },
      });

      const saldoDevuelto = factura.saldoPendiente.plus(imputacion.montoImputado);

      await tx.facturaProveedor.update({
        where: { id: factura.id },
        data: {
          saldoPendiente: saldoDevuelto,
          estado: estadoSegunSaldo(factura.montoTotal, saldoDevuelto),
        },
      });
    }

    // 2'. Se borran las imputaciones del cheque.
    await tx.imputacionCheque.deleteMany({ where: { chequeId: cheque.id } });

    // 5'. Se borra el pago: nunca existió, porque el cheque no pagó nada.
    await tx.pagoProveedor.deleteMany({ where: { chequeId: cheque.id } });

    // 4'. El proveedor vuelve a ser acreedor por el nominal completo, que es lo
    //     mismo que la entrega le había descontado.
    const proveedorActualizado = await tx.proveedor.update({
      where: { id: proveedor.id },
      data: { saldo: proveedor.saldo.plus(cheque.nominal) },
    });

    // 1'. El cheque vuelve a la cartera. Al limpiar `fecha_entrega` el ahorro deja
    //     de estar realizado y vuelve a ser latente, sin tocar ningún registro de
    //     ahorro: no existe ninguno, se deriva de esta misma fecha (ver cartera.ts).
    //     Correcto para este caso, porque la entrega no existió. Un cheque que
    //     rebotó SÍ conserva su ahorro, y por eso no pasa por acá (§4.4).
    const chequeEnCartera = await tx.cheque.update({
      where: { id: cheque.id },
      data: {
        estado: "en_cartera",
        fechaEntrega: null,
        proveedorDestinoId: null,
      },
    });

    return {
      cheque: chequeEnCartera,
      proveedor: proveedorActualizado,
      /** Lo que se le devolvió a cada factura, para poder mostrarlo. */
      imputacionesRevertidas: cheque.imputaciones.length,
    };
  });
}
