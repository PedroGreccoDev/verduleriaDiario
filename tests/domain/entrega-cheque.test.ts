import { beforeEach, describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import type { ErrorDominio } from "@/lib/errores";
import { comprarCheque } from "@/domain/cheques/compra.service";
import { entregarCheque } from "@/domain/cheques/entrega.service";
import { ahorroRealizado, saldoCartera } from "@/domain/cheques/cartera";
import { crearFacturaProveedor } from "@/domain/proveedores/factura.service";
import { prisma } from "../setup";
import {
  crearFactura,
  crearProveedor,
  crearVendedor,
  facturaRecargada,
  movimientosDeCaja,
  proveedorRecargado,
  sembrarCategorias,
} from "../factories";

/** §4.3 Entrega de cheque a proveedor. El flujo que toca cinco tablas. */

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

/** Cheque de nominal 100.000 comprado al 10%: pagado 90.000, ahorro 10.000. */
async function chequeEnCartera(nominal = "100000", porcentaje = "10", numero = "0001") {
  const vendedor = await crearVendedor();
  const { cheque } = await comprarCheque({
    numero,
    banco: "Nación",
    librador: "Frutas del Valle SA",
    nominal: dec(nominal),
    porcentajeDescuento: dec(porcentaje),
    fechaVencimiento: new Date("2026-12-01"),
    vendedorChequeId: vendedor.id,
  });
  return cheque;
}

describe("un cheque que cubre varias facturas", () => {
  it("imputa a cada factura y las deja en el estado que corresponde", async () => {
    const proveedor = await crearProveedor();
    const a = await crearFactura(proveedor.id, "A-001", "30000");
    const b = await crearFactura(proveedor.id, "A-002", "45000");
    const c = await crearFactura(proveedor.id, "A-003", "50000");
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [
        { facturaProveedorId: a.id, monto: dec("30000") },
        { facturaProveedorId: b.id, monto: dec("45000") },
        { facturaProveedorId: c.id, monto: dec("25000") },
      ],
    });

    expect((await facturaRecargada(a.id)).estado).toBe("pagada");
    expect((await facturaRecargada(b.id)).estado).toBe("pagada");

    const parcial = await facturaRecargada(c.id);
    expect(parcial.estado).toBe("parcial");
    expect(parcial.saldoPendiente.toString()).toBe("25000");

    const imputaciones = await prisma.imputacionCheque.findMany({
      where: { chequeId: cheque.id },
    });
    expect(imputaciones).toHaveLength(3);
  });

  it("deja el saldo del proveedor en cero cuando el nominal iguala la deuda", async () => {
    const proveedor = await crearProveedor();
    const a = await crearFactura(proveedor.id, "A-001", "60000");
    const b = await crearFactura(proveedor.id, "A-002", "40000");
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [
        { facturaProveedorId: a.id, monto: dec("60000") },
        { facturaProveedorId: b.id, monto: dec("40000") },
      ],
    });

    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe("0");
  });
});

describe("cheque con nominal mayor a la deuda", () => {
  it("el excedente deja el saldo del proveedor en negativo (§4.3)", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "70000");
    const cheque = await chequeEnCartera(); // nominal 100.000

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("70000") }],
    });

    // Se debía 70.000 y se entregó un cheque de 100.000: quedan 30.000 a favor.
    const recargado = await proveedorRecargado(proveedor.id);
    expect(recargado.saldo.toString()).toBe("-30000");
    expect(recargado.saldo.isNegative()).toBe(true);

    // La factura queda saldada, no sobrepagada: el excedente no vive acá.
    const facturaFinal = await facturaRecargada(factura.id);
    expect(facturaFinal.estado).toBe("pagada");
    expect(facturaFinal.saldoPendiente.toString()).toBe("0");
  });

  it("el saldo a favor se descuenta solo de la próxima factura (§3.3)", async () => {
    const proveedor = await crearProveedor();
    const primera = await crearFactura(proveedor.id, "A-001", "70000");
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [{ facturaProveedorId: primera.id, monto: dec("70000") }],
    });

    const { factura, creditoAplicado } = await crearFacturaProveedor({
      proveedorId: proveedor.id,
      numero: "A-002",
      montoTotal: dec("50000"),
    });

    expect(creditoAplicado.toString()).toBe("30000");
    expect(factura.saldoPendiente.toString()).toBe("20000");
    expect(factura.estado).toBe("parcial");
    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe("20000");
  });

  it("una factura menor al saldo a favor nace pagada", async () => {
    const proveedor = await crearProveedor();
    const primera = await crearFactura(proveedor.id, "A-001", "20000");
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [{ facturaProveedorId: primera.id, monto: dec("20000") }],
    });
    // Quedan 80.000 a favor.

    const { factura } = await crearFacturaProveedor({
      proveedorId: proveedor.id,
      numero: "A-002",
      montoTotal: dec("50000"),
    });

    expect(factura.estado).toBe("pagada");
    expect(factura.saldoPendiente.toString()).toBe("0");
    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe("-30000");
  });

  it("entregar sin imputar a ninguna factura es un adelanto entero a favor", async () => {
    const proveedor = await crearProveedor();
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [],
    });

    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe("-100000");
  });
});

describe("invariantes de la entrega", () => {
  it("NO genera movimiento de la Bolsa Grande (§4.3)", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "80000");
    const cheque = await chequeEnCartera();

    const movimientosAntes = await movimientosDeCaja();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("80000") }],
    });

    const movimientosDespues = await movimientosDeCaja();

    // El único movimiento es el egreso de la compra del cheque. La entrega no suma.
    expect(movimientosDespues).toHaveLength(movimientosAntes.length);
    expect(movimientosDespues).toHaveLength(1);
    expect(movimientosDespues[0].categoria.slug).toBe("compra_cheques");
  });

  it("el ahorro se realiza recién en la entrega, a la fecha de entrega (§6)", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "100000");
    const cheque = await chequeEnCartera();

    const antes = await ahorroRealizado(new Date("2026-01-01"), new Date("2026-12-31"));
    expect(antes.total.toString()).toBe("0");

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("100000") }],
      fechaEntrega: new Date("2026-08-11T10:00:00Z"),
    });

    const despues = await ahorroRealizado(new Date("2026-08-01"), new Date("2026-08-31"));
    expect(despues.total.toString()).toBe("10000");
    expect(despues.nominalEntregado.toString()).toBe("100000");
    expect(despues.pagadoPorEsosCheques.toString()).toBe("90000");

    // Fuera del período de la entrega, no cuenta.
    const otroMes = await ahorroRealizado(new Date("2026-09-01"), new Date("2026-09-30"));
    expect(otroMes.total.toString()).toBe("0");
  });

  it("el cheque sale de la cartera", async () => {
    const proveedor = await crearProveedor();
    const cheque = await chequeEnCartera();

    expect((await saldoCartera()).toString()).toBe("100000");

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [],
    });

    expect((await saldoCartera()).toString()).toBe("0");

    const recargado = await prisma.cheque.findUniqueOrThrow({ where: { id: cheque.id } });
    expect(recargado.estado).toBe("entregado");
    expect(recargado.fechaEntrega).not.toBeNull();
    expect(recargado.proveedorDestinoId).toBe(proveedor.id);
  });

  it("deja el pago con medio = cheque por el NOMINAL, no por lo pagado", async () => {
    const proveedor = await crearProveedor();
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [],
    });

    const pago = await prisma.pagoProveedor.findFirstOrThrow({
      where: { chequeId: cheque.id },
    });
    expect(pago.medio).toBe("cheque");
    expect(pago.monto.toString()).toBe("100000");
  });
});

describe("validaciones", () => {
  it("rechaza imputar más que el nominal (§4.3, validación clave)", async () => {
    const proveedor = await crearProveedor();
    const a = await crearFactura(proveedor.id, "A-001", "80000");
    const b = await crearFactura(proveedor.id, "A-002", "80000");
    const cheque = await chequeEnCartera(); // nominal 100.000

    expect(
      await codigoDelError(() =>
        entregarCheque({
          chequeId: cheque.id,
          proveedorId: proveedor.id,
          imputaciones: [
            { facturaProveedorId: a.id, monto: dec("80000") },
            { facturaProveedorId: b.id, monto: dec("30000") },
          ],
        }),
      ),
    ).toBe("IMPUTACION_SUPERA_NOMINAL");
  });

  it("no deja nada a medias cuando la imputación es inválida", async () => {
    const proveedor = await crearProveedor();
    const a = await crearFactura(proveedor.id, "A-001", "80000");
    const b = await crearFactura(proveedor.id, "A-002", "80000");
    const cheque = await chequeEnCartera();
    const saldoInicial = (await proveedorRecargado(proveedor.id)).saldo.toString();

    await expect(
      entregarCheque({
        chequeId: cheque.id,
        proveedorId: proveedor.id,
        imputaciones: [
          { facturaProveedorId: a.id, monto: dec("80000") },
          { facturaProveedorId: b.id, monto: dec("30000") },
        ],
      }),
    ).rejects.toThrow();

    expect((await facturaRecargada(a.id)).saldoPendiente.toString()).toBe("80000");
    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe(saldoInicial);
    expect((await saldoCartera()).toString()).toBe("100000");
    expect(await prisma.imputacionCheque.count()).toBe(0);
    expect(await prisma.pagoProveedor.count()).toBe(0);
  });

  it("rechaza imputar a una factura más de lo que debe", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "30000");
    const cheque = await chequeEnCartera();

    expect(
      await codigoDelError(() =>
        entregarCheque({
          chequeId: cheque.id,
          proveedorId: proveedor.id,
          imputaciones: [{ facturaProveedorId: factura.id, monto: dec("50000") }],
        }),
      ),
    ).toBe("IMPUTACION_SUPERA_SALDO_FACTURA");
  });

  it("rechaza una factura de otro proveedor", async () => {
    const proveedor = await crearProveedor("Proveedor A");
    const otro = await crearProveedor("Proveedor B");
    const facturaAjena = await crearFactura(otro.id, "B-001", "30000");
    const cheque = await chequeEnCartera();

    expect(
      await codigoDelError(() =>
        entregarCheque({
          chequeId: cheque.id,
          proveedorId: proveedor.id,
          imputaciones: [{ facturaProveedorId: facturaAjena.id, monto: dec("30000") }],
        }),
      ),
    ).toBe("FACTURA_DE_OTRO_PROVEEDOR");
  });

  it("rechaza la misma factura dos veces en la misma entrega", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "60000");
    const cheque = await chequeEnCartera();

    expect(
      await codigoDelError(() =>
        entregarCheque({
          chequeId: cheque.id,
          proveedorId: proveedor.id,
          imputaciones: [
            { facturaProveedorId: factura.id, monto: dec("30000") },
            { facturaProveedorId: factura.id, monto: dec("30000") },
          ],
        }),
      ),
    ).toBe("IMPUTACION_DUPLICADA");
  });

  it("no se puede entregar dos veces el mismo cheque", async () => {
    const proveedor = await crearProveedor();
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [],
    });

    expect(
      await codigoDelError(() =>
        entregarCheque({
          chequeId: cheque.id,
          proveedorId: proveedor.id,
          imputaciones: [],
        }),
      ),
    ).toBe("CHEQUE_FUERA_DE_CARTERA");
  });
});
