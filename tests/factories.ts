import { dec } from "@/lib/decimal";
import { sembrarCategoriasSistema } from "@/domain/caja/categorias";
import { crearFacturaProveedor } from "@/domain/proveedores/factura.service";
import { prisma } from "./setup";

/**
 * Constructores mínimos para los tests. Nada de datos aleatorios: si un test falla,
 * tiene que fallar siempre con los mismos números.
 */

export async function sembrarCategorias() {
  await sembrarCategoriasSistema(prisma);
}

export async function crearProveedor(nombre = "Verdulería Mayorista SA") {
  return prisma.proveedor.create({ data: { nombre } });
}

export async function crearVendedor(nombre = "Cheques del Sur") {
  return prisma.vendedorCheque.create({ data: { nombre } });
}

export async function crearCliente(nombre = "Rosa Giménez", limiteCredito?: string) {
  return prisma.cliente.create({
    data: { nombre, limiteCredito: limiteCredito ? dec(limiteCredito) : null },
  });
}

/** Factura pasando por el servicio, para que el saldo del proveedor quede bien. */
export async function crearFactura(
  proveedorId: string,
  numero: string,
  montoTotal: string,
) {
  const { factura } = await crearFacturaProveedor({
    proveedorId,
    numero,
    montoTotal: dec(montoTotal),
    fecha: new Date("2026-08-01"),
  });
  return factura;
}

export async function proveedorRecargado(id: string) {
  return prisma.proveedor.findUniqueOrThrow({ where: { id } });
}

export async function facturaRecargada(id: string) {
  return prisma.facturaProveedor.findUniqueOrThrow({ where: { id } });
}

export async function movimientosDeCaja() {
  return prisma.movimientoCaja.findMany({
    include: { categoria: true },
    orderBy: { fecha: "asc" },
  });
}
