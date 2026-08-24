import { prisma } from "@/lib/prisma";
import type { Decimal } from "@/lib/decimal";
import { registrarMovimientoCaja } from "@/domain/caja/movimiento.service";
import { calcularCheque } from "./calculo";

export interface DatosCompraCheque {
  numero: string;
  banco: string;
  librador: string;
  nominal: Decimal;
  porcentajeDescuento: Decimal;
  fechaVencimiento: Date;
  vendedorChequeId: string;
  fechaCompra?: Date;
  observacion?: string | null;
  /** Por defecto se asocia al turno abierto. `null` lo deja fuera de turno. */
  turnoId?: string | null;
  /** Quién la carga (§9). */
  usuarioId?: string | null;
}

/**
 * Compra de cheque (§4.2).
 *
 * Es una CONVERSIÓN, no un gasto (§2.3): sale efectivo de la Bolsa Grande por el
 * monto pagado, y entra valor nominal —mayor— a la cartera.
 *
 * NO se registra ahorro. La diferencia queda latente: el cheque todavía puede
 * rebotar, vencer o no llegar a usarse. El ahorro se realiza recién en la entrega
 * (§4.3). Buscar acá cualquier registro de ahorro es buscar un error.
 *
 * Va en transacción porque toca dos tablas: si se creara el cheque y fallara el
 * movimiento de caja, habría un cheque en cartera que nadie pagó.
 */
export async function comprarCheque(datos: DatosCompraCheque) {
  const calculo = calcularCheque(datos.nominal, datos.porcentajeDescuento);

  return prisma.$transaction(async (tx) => {
    const cheque = await tx.cheque.create({
      data: {
        numero: datos.numero,
        banco: datos.banco,
        librador: datos.librador,
        nominal: calculo.nominal,
        porcentajeDescuento: calculo.porcentajeDescuento,
        montoPagado: calculo.montoPagado,
        ahorro: calculo.ahorro,
        fechaCompra: datos.fechaCompra ?? new Date(),
        fechaVencimiento: datos.fechaVencimiento,
        vendedorChequeId: datos.vendedorChequeId,
        estado: "en_cartera",
        observacion: datos.observacion ?? null,
      },
    });

    // Egreso por lo PAGADO, nunca por el nominal: de la Bolsa Grande salieron $900,
    // no $1.000.
    const movimiento = await registrarMovimientoCaja(tx, {
      categoriaSlug: "compra_cheques",
      monto: calculo.montoPagado,
      referenciaTipo: "compra_cheque",
      referenciaId: cheque.id,
      turnoId: datos.turnoId,
      fecha: datos.fechaCompra,
      observacion: `Cheque ${cheque.banco} ${cheque.numero}`,
      usuarioId: datos.usuarioId,
    });

    return { cheque, movimiento };
  });
}
