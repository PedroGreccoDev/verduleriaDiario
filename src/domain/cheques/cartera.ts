import { prisma, type PrismaTx } from "@/lib/prisma";
import { CERO, dec, type Decimal } from "@/lib/decimal";

/**
 * Consultas sobre la cartera y el ahorro (§5.2).
 *
 * Ni la cartera ni el ahorro tienen tabla propia, a propósito. Ambos se derivan de
 * `cheque`, así que no pueden desincronizarse de los cheques que representan, y el
 * ahorro no tiene forma de aparecer en el reporte de caja de §5.1 — que lee
 * exclusivamente `movimiento_caja`.
 */

/**
 * Saldo de la cartera, a valor NOMINAL (§2.1).
 *
 * No se suma ni se compara con la Bolsa Grande: son dos depósitos de valor
 * distintos. Un total que los mezcle está mal por definición.
 */
export async function saldoCartera(cliente: PrismaTx = prisma): Promise<Decimal> {
  const { _sum } = await cliente.cheque.aggregate({
    where: { estado: "en_cartera" },
    _sum: { nominal: true },
  });

  return _sum.nominal ?? CERO;
}

export async function chequesEnCartera(cliente: PrismaTx = prisma) {
  return cliente.cheque.findMany({
    where: { estado: "en_cartera" },
    orderBy: { fechaVencimiento: "asc" },
    include: { vendedorCheque: true },
  });
}

/**
 * Lo que la verdulería pagó por la cartera que hoy tiene. Comparado con
 * `saldoCartera`, la diferencia es el ahorro LATENTE: el que todavía no se realizó
 * y podría no realizarse nunca (§2.3).
 */
export async function costoCartera(cliente: PrismaTx = prisma): Promise<Decimal> {
  const { _sum } = await cliente.cheque.aggregate({
    where: { estado: "en_cartera" },
    _sum: { montoPagado: true },
  });

  return _sum.montoPagado ?? CERO;
}

export interface AhorroDelPeriodo {
  total: Decimal;
  nominalEntregado: Decimal;
  pagadoPorEsosCheques: Decimal;
  cantidadCheques: number;
}

/**
 * Ahorro REALIZADO en un período (§5.2), imputado a la fecha de entrega (§6).
 *
 * Filtra por `fecha_entrega` y NO por estado. Es intencional: un cheque entregado
 * que después rebotó sigue contando, porque §4.4 dice que el rechazo no revierte
 * el ahorro — el proveedor ya cobró su deuda y quien repone es el vendedor.
 *
 * Este número no es un ingreso y no entra en ningún total de la Bolsa Grande.
 * Es un menor egreso: se cancelaron $1.000 de deuda habiendo gastado $900.
 */
export async function ahorroRealizado(
  desde: Date,
  hasta: Date,
  cliente: PrismaTx = prisma,
): Promise<AhorroDelPeriodo> {
  const where = { fechaEntrega: { gte: desde, lte: hasta } };

  const { _sum, _count } = await cliente.cheque.aggregate({
    where,
    _sum: { ahorro: true, nominal: true, montoPagado: true },
    _count: true,
  });

  return {
    total: _sum.ahorro ?? CERO,
    nominalEntregado: _sum.nominal ?? CERO,
    pagadoPorEsosCheques: _sum.montoPagado ?? CERO,
    cantidadCheques: _count,
  };
}

/** Rechazos por librador y por vendedor (§5.2). Solo informativo. */
export async function historialRechazos(cliente: PrismaTx = prisma) {
  const rechazados = await cliente.cheque.findMany({
    where: { estado: "rechazado" },
    include: { vendedorCheque: true, proveedorDestino: true },
    orderBy: { fechaRechazo: "desc" },
  });

  const porLibrador = new Map<string, { cantidad: number; nominal: Decimal }>();
  const porVendedor = new Map<string, { cantidad: number; nominal: Decimal }>();

  for (const cheque of rechazados) {
    acumular(porLibrador, cheque.librador, cheque.nominal);
    acumular(porVendedor, cheque.vendedorCheque.nombre, cheque.nominal);
  }

  return { rechazados, porLibrador, porVendedor };
}

function acumular(
  mapa: Map<string, { cantidad: number; nominal: Decimal }>,
  clave: string,
  nominal: Decimal,
): void {
  const actual = mapa.get(clave) ?? { cantidad: 0, nominal: dec(0) };
  mapa.set(clave, {
    cantidad: actual.cantidad + 1,
    nominal: actual.nominal.plus(nominal),
  });
}
