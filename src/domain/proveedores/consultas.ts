import { prisma } from "@/lib/prisma";
import { CERO, type Decimal } from "@/lib/decimal";

/** Consultas de lectura para las pantallas de proveedores. Sin efectos. */

export interface ProveedorConDeuda {
  id: string;
  nombre: string;
  /** Positivo = se le debe. Negativo = saldo a favor nuestro (§3.3). */
  saldo: Decimal;
  facturasPendientes: number;
  /** La factura pendiente que vence primero, para saber a quién hay que pagarle ya. */
  proximoVencimiento: Date | null;
}

/**
 * Todos los proveedores activos con su situación de cuenta (§5.3).
 *
 * Incluye a los que no deben nada: si solo se listaran los que tienen deuda, un
 * proveedor con saldo a favor —que es plata nuestra adelantada— desaparecería de
 * la pantalla justo cuando conviene recordarlo.
 */
export async function proveedoresConDeuda(): Promise<ProveedorConDeuda[]> {
  const proveedores = await prisma.proveedor.findMany({
    where: { activo: true },
    include: {
      facturas: {
        where: { estado: { in: ["pendiente", "parcial"] } },
        orderBy: [{ fechaVencimiento: "asc" }, { fecha: "asc" }],
      },
    },
    orderBy: { nombre: "asc" },
  });

  return proveedores.map((proveedor) => ({
    id: proveedor.id,
    nombre: proveedor.nombre,
    saldo: proveedor.saldo,
    facturasPendientes: proveedor.facturas.length,
    proximoVencimiento:
      proveedor.facturas.find((f) => f.fechaVencimiento !== null)?.fechaVencimiento ?? null,
  }));
}

export interface CuentaProveedor {
  proveedor: { id: string; nombre: string; saldo: Decimal; activo: boolean };
  facturas: {
    id: string;
    numero: string;
    fecha: Date;
    fechaVencimiento: Date | null;
    montoTotal: Decimal;
    saldoPendiente: Decimal;
    estado: string;
  }[];
  /** Cheques y efectivo que se le entregaron, lo más reciente primero. */
  pagos: {
    id: string;
    fecha: Date;
    medio: string;
    monto: Decimal;
    observacion: string | null;
    /** Nulo en los pagos en efectivo. */
    cheque: { banco: string; numero: string; rechazado: boolean } | null;
  }[];
  deudaPendiente: Decimal;
}

/**
 * Estado de cuenta de un proveedor: qué se le debe y qué se le pagó (§5.3).
 *
 * Las facturas van TODAS, no solo las pendientes: una factura pagada es la prueba
 * de que se pagó, y sacarla de la lista deja al operador sin con qué responder
 * cuando el proveedor reclama.
 */
export async function cuentaDeProveedor(proveedorId: string): Promise<CuentaProveedor | null> {
  const proveedor = await prisma.proveedor.findUnique({
    where: { id: proveedorId },
    include: {
      facturas: { orderBy: [{ fecha: "desc" }] },
      pagos: { include: { cheque: true }, orderBy: { fecha: "desc" } },
    },
  });

  if (!proveedor) return null;

  return {
    proveedor: {
      id: proveedor.id,
      nombre: proveedor.nombre,
      saldo: proveedor.saldo,
      activo: proveedor.activo,
    },
    facturas: proveedor.facturas.map((f) => ({
      id: f.id,
      numero: f.numero,
      fecha: f.fecha,
      fechaVencimiento: f.fechaVencimiento,
      montoTotal: f.montoTotal,
      saldoPendiente: f.saldoPendiente,
      estado: f.estado,
    })),
    pagos: proveedor.pagos.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      medio: p.medio,
      monto: p.monto,
      observacion: p.observacion,
      cheque: p.cheque
        ? {
            banco: p.cheque.banco,
            numero: p.cheque.numero,
            // Un cheque rebotado no deshace el pago (§4.4), pero el operador tiene
            // que verlo acá: es el que va a tener que reclamarle a la financiera.
            rechazado: p.cheque.estado === "rechazado",
          }
        : null,
    })),
    deudaPendiente: proveedor.facturas.reduce<Decimal>(
      (acc, f) => acc.plus(f.saldoPendiente),
      CERO,
    ),
  };
}
