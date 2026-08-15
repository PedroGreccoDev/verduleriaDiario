import { prisma } from "@/lib/prisma";
import { CERO, type Decimal } from "@/lib/decimal";
import type { TipoMovimientoCaja } from "@/generated/prisma/enums";
import type { Periodo } from "./periodo";

/**
 * Reporte de ingresos y egresos (§5.1).
 *
 * **Alcance: exclusivamente `movimiento_caja`.** No hay ventas acá porque el
 * sistema no las registra (§2.4): esto es flujo de caja, no facturación. Tampoco
 * aparece la cartera de cheques —que se mide a nominal— ni el ahorro, que no es
 * plata que entra sino un egreso que no ocurrió (§2.3). Sumar cualquiera de las
 * dos cosas a estos totales daría un número que no existe.
 */

export interface FiltrosReporte {
  periodo: Periodo;
  tipo?: TipoMovimientoCaja | null;
  categoriaId?: string | null;
}

export interface MovimientoDelReporte {
  id: string;
  fecha: Date;
  tipo: TipoMovimientoCaja;
  categoria: string;
  monto: Decimal;
  observacion: string | null;
  /** Nulo en los movimientos que se registraron fuera de turno (§3.1). */
  turno: { fecha: Date; nombre: string } | null;
}

export interface ReporteCaja {
  movimientos: MovimientoDelReporte[];
  totalIngresos: Decimal;
  totalEgresos: Decimal;
  /**
   * Ingresos − egresos DEL PERÍODO. No es la plata que hay en la Bolsa Grande:
   * un período que empieza con dinero de antes puede dar neto negativo sin que la
   * caja esté vacía.
   */
  neto: Decimal;
}

export async function reporteIngresosEgresos(filtros: FiltrosReporte): Promise<ReporteCaja> {
  const movimientos = await prisma.movimientoCaja.findMany({
    where: {
      fecha: { gte: filtros.periodo.desde, lt: filtros.periodo.hasta },
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
    },
    include: { categoria: true, turno: true },
    orderBy: { fecha: "desc" },
  });

  let totalIngresos = CERO;
  let totalEgresos = CERO;

  for (const movimiento of movimientos) {
    if (movimiento.tipo === "ingreso") {
      totalIngresos = totalIngresos.plus(movimiento.monto);
    } else {
      totalEgresos = totalEgresos.plus(movimiento.monto);
    }
  }

  return {
    movimientos: movimientos.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      categoria: m.categoria.nombre,
      monto: m.monto,
      observacion: m.observacion,
      turno: m.turno ? { fecha: m.turno.fecha, nombre: m.turno.nombre } : null,
    })),
    totalIngresos,
    totalEgresos,
    neto: totalIngresos.minus(totalEgresos),
  };
}

/** Las categorías que existen, para armar el filtro de la pantalla. */
export async function categoriasParaFiltrar() {
  return prisma.categoriaMovimiento.findMany({
    where: { activo: true },
    orderBy: [{ tipo: "asc" }, { orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, tipo: true },
  });
}
