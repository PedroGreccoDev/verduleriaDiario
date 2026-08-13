import { prisma } from "@/lib/prisma";
import { errorDominio } from "@/lib/errores";

export interface DatosRechazoCheque {
  chequeId: string;
  motivo: string;
  fechaRechazo?: Date;
}

/**
 * Cheque rechazado (§4.4).
 *
 * Este flujo llama la atención por lo poco que hace. Cambia un estado y guarda
 * fecha y motivo. Nada más. Es correcto:
 *
 * - **Quien vendió el cheque debe levantarlo**, pagándole directo al proveedor
 *   que lo recibió.
 * - **La verdulería no repone dinero.** No se reabre la deuda con el proveedor,
 *   no se revierten las imputaciones, no hay egreso de caja.
 * - **No se revierte el ahorro.** El cheque ya fue entregado y canceló deuda; que
 *   después rebote es problema del vendedor. Por eso las consultas de ahorro
 *   filtran por `fecha_entrega` y no por estado: un cheque rechazado sigue
 *   contando el ahorro del período en que se entregó.
 *
 * El registro es solo informativo, pero es la base de los dos reportes de §5.2:
 * libradores con rechazos y vendedores con rechazos.
 *
 * No necesita transacción: toca una sola tabla y una sola fila.
 */
export async function rechazarCheque(datos: DatosRechazoCheque) {
  const cheque = await prisma.cheque.findUnique({ where: { id: datos.chequeId } });

  if (!cheque) {
    throw errorDominio("CHEQUE_NO_ENCONTRADO", `No existe el cheque ${datos.chequeId}.`);
  }

  if (cheque.estado === "rechazado") {
    throw errorDominio(
      "CHEQUE_YA_RECHAZADO",
      `El cheque ${cheque.banco} ${cheque.numero} ya figura como rechazado.`,
    );
  }

  // Un cheque que sigue en cartera no puede rebotar: nadie lo depositó todavía.
  //
  // Esto también deja fuera a un cheque cuya entrega se revirtió, y está bien: si
  // se revirtió la entrega es porque estaba mal cargada, así que esa entrega no
  // ocurrió y no hay nada que pueda haber rebotado. El rebote de una entrega real
  // se registra acá directamente, sin revertir nada (§4.4).
  if (!cheque.fechaEntrega) {
    throw errorDominio(
      "CHEQUE_NO_ENTREGADO",
      `El cheque ${cheque.banco} ${cheque.numero} está en cartera y no fue entregado a nadie, ` +
        "así que no pudo rebotar.",
    );
  }

  return prisma.cheque.update({
    where: { id: cheque.id },
    data: {
      estado: "rechazado",
      fechaRechazo: datos.fechaRechazo ?? new Date(),
      motivoRechazo: datos.motivo,
    },
  });
}
