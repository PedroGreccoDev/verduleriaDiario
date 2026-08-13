import { prisma } from "@/lib/prisma";
import { CERO, type Decimal } from "@/lib/decimal";
import { chequesEnCartera, costoCartera, saldoCartera, ahorroRealizado } from "./cartera";

/** Consultas de lectura para las pantallas de cheques. Sin efectos. */

export interface ResumenCartera {
  cheques: Awaited<ReturnType<typeof chequesEnCartera>>;
  /** A valor nominal. NO se suma con la Bolsa Grande (§2.1). */
  nominalTotal: Decimal;
  /** Lo que se pagó por esos cheques. */
  costoTotal: Decimal;
  /** Diferencia entre ambos: ahorro que todavía no se realizó y puede no realizarse. */
  ahorroLatente: Decimal;
  ahorroDelMes: Decimal;
  chequesEntregadosEnElMes: number;
}

export async function resumenCartera(hoy: Date = new Date()): Promise<ResumenCartera> {
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

  const [cheques, nominalTotal, costoTotal, ahorro] = await Promise.all([
    chequesEnCartera(),
    saldoCartera(),
    costoCartera(),
    ahorroRealizado(desde, hasta),
  ]);

  return {
    cheques,
    nominalTotal,
    costoTotal,
    ahorroLatente: nominalTotal.minus(costoTotal),
    ahorroDelMes: ahorro.total,
    chequesEntregadosEnElMes: ahorro.cantidadCheques,
  };
}

export async function vendedoresActivos() {
  return prisma.vendedorCheque.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
}

export async function proveedoresActivos() {
  return prisma.proveedor.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
}

export async function chequeEnCarteraPorId(id: string) {
  return prisma.cheque.findFirst({
    where: { id, estado: "en_cartera" },
    include: { vendedorCheque: true },
  });
}

export interface DatosEntrega {
  proveedor: { id: string; nombre: string; saldo: Decimal };
  facturas: {
    id: string;
    numero: string;
    fecha: Date;
    fechaVencimiento: Date | null;
    montoTotal: Decimal;
    saldoPendiente: Decimal;
  }[];
  deudaTotal: Decimal;
}

/** Facturas pendientes del proveedor, para armar la imputación de §4.3. */
export async function datosParaEntrega(proveedorId: string): Promise<DatosEntrega | null> {
  const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId } });
  if (!proveedor) return null;

  const facturas = await prisma.facturaProveedor.findMany({
    where: { proveedorId, estado: { in: ["pendiente", "parcial"] } },
    orderBy: [{ fechaVencimiento: "asc" }, { fecha: "asc" }],
  });

  return {
    proveedor: { id: proveedor.id, nombre: proveedor.nombre, saldo: proveedor.saldo },
    facturas: facturas.map((f) => ({
      id: f.id,
      numero: f.numero,
      fecha: f.fecha,
      fechaVencimiento: f.fechaVencimiento,
      montoTotal: f.montoTotal,
      saldoPendiente: f.saldoPendiente,
    })),
    deudaTotal: facturas.reduce<Decimal>((acc, f) => acc.plus(f.saldoPendiente), CERO),
  };
}
