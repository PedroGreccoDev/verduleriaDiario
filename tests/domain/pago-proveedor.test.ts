import { beforeEach, describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import type { ErrorDominio } from "@/lib/errores";
import { pagarProveedorEnEfectivo } from "@/domain/proveedores/pago.service";
import { ahorroRealizado } from "@/domain/cheques/cartera";
import { abrirTurno } from "@/domain/caja/turno.service";
import { prisma } from "../setup";
import {
  crearFactura,
  crearProveedor,
  facturaRecargada,
  movimientosDeCaja,
  proveedorRecargado,
  sembrarCategorias,
} from "../factories";

/** §4.5 Pago a proveedor en efectivo. */

beforeEach(async () => {
  await sembrarCategorias();
});

async function codigoDelError(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    return (error as ErrorDominio).codigo;
  }
  throw new Error("Se esperaba un error de dominio y no hubo ninguno.");
}

describe("pago en efectivo", () => {
  it("genera egreso de la Bolsa Grande, a diferencia de la entrega de cheque", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "50000");
    await abrirTurno({ nombre: "mañana" });

    const { pago } = await pagarProveedorEnEfectivo({
      proveedorId: proveedor.id,
      monto: dec("50000"),
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("50000") }],
    });

    const [movimiento] = await movimientosDeCaja();
    expect(movimiento.tipo).toBe("egreso");
    expect(movimiento.categoria.slug).toBe("pago_proveedor_efectivo");
    expect(movimiento.monto.toString()).toBe("50000");
    expect(movimiento.referenciaId).toBe(pago.id);
  });

  it("no genera ahorro (§4.5)", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "50000");

    await pagarProveedorEnEfectivo({
      proveedorId: proveedor.id,
      monto: dec("50000"),
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("50000") }],
    });

    const ahorro = await ahorroRealizado(new Date("2026-01-01"), new Date("2026-12-31"));
    expect(ahorro.total.toString()).toBe("0");
  });

  it("cubre varias facturas con un solo pago", async () => {
    const proveedor = await crearProveedor();
    const a = await crearFactura(proveedor.id, "A-001", "20000");
    const b = await crearFactura(proveedor.id, "A-002", "35000");

    await pagarProveedorEnEfectivo({
      proveedorId: proveedor.id,
      monto: dec("45000"),
      imputaciones: [
        { facturaProveedorId: a.id, monto: dec("20000") },
        { facturaProveedorId: b.id, monto: dec("25000") },
      ],
    });

    expect((await facturaRecargada(a.id)).estado).toBe("pagada");

    const parcial = await facturaRecargada(b.id);
    expect(parcial.estado).toBe("parcial");
    expect(parcial.saldoPendiente.toString()).toBe("10000");

    expect(await prisma.imputacionPago.count()).toBe(2);
    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe("10000");
  });

  it("pagar de más deja saldo a favor, igual que con cheque", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "30000");

    await pagarProveedorEnEfectivo({
      proveedorId: proveedor.id,
      monto: dec("50000"),
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("30000") }],
    });

    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe("-20000");
  });

  it("el egreso de caja es por el monto pagado, no por lo imputado", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "30000");

    await pagarProveedorEnEfectivo({
      proveedorId: proveedor.id,
      monto: dec("50000"),
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("30000") }],
    });

    const [movimiento] = await movimientosDeCaja();
    expect(movimiento.monto.toString()).toBe("50000");
  });
});

describe("validaciones", () => {
  it("rechaza imputar más que el monto del pago", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "80000");

    expect(
      await codigoDelError(() =>
        pagarProveedorEnEfectivo({
          proveedorId: proveedor.id,
          monto: dec("50000"),
          imputaciones: [{ facturaProveedorId: factura.id, monto: dec("60000") }],
        }),
      ),
    ).toBe("IMPUTACION_SUPERA_PAGO");
  });

  it("no deja nada a medias si la validación falla", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "80000");
    const saldoInicial = (await proveedorRecargado(proveedor.id)).saldo.toString();

    await expect(
      pagarProveedorEnEfectivo({
        proveedorId: proveedor.id,
        monto: dec("50000"),
        imputaciones: [{ facturaProveedorId: factura.id, monto: dec("60000") }],
      }),
    ).rejects.toThrow();

    expect((await facturaRecargada(factura.id)).saldoPendiente.toString()).toBe("80000");
    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe(saldoInicial);
    expect(await prisma.pagoProveedor.count()).toBe(0);
    expect(await movimientosDeCaja()).toHaveLength(0);
  });

  it("rechaza pagar a un proveedor dado de baja", async () => {
    const proveedor = await crearProveedor();
    await prisma.proveedor.update({
      where: { id: proveedor.id },
      data: { activo: false },
    });

    expect(
      await codigoDelError(() =>
        pagarProveedorEnEfectivo({
          proveedorId: proveedor.id,
          monto: dec("10000"),
          imputaciones: [],
        }),
      ),
    ).toBe("PROVEEDOR_INACTIVO");
  });

  it("rechaza una factura ya saldada", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "30000");

    await pagarProveedorEnEfectivo({
      proveedorId: proveedor.id,
      monto: dec("30000"),
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("30000") }],
    });

    expect(
      await codigoDelError(() =>
        pagarProveedorEnEfectivo({
          proveedorId: proveedor.id,
          monto: dec("5000"),
          imputaciones: [{ facturaProveedorId: factura.id, monto: dec("5000") }],
        }),
      ),
    ).toBe("FACTURA_YA_PAGADA");
  });
});
