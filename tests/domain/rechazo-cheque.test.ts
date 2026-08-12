import { beforeEach, describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import type { ErrorDominio } from "@/lib/errores";
import { comprarCheque } from "@/domain/cheques/compra.service";
import { entregarCheque } from "@/domain/cheques/entrega.service";
import { rechazarCheque } from "@/domain/cheques/rechazo.service";
import { ahorroRealizado, historialRechazos } from "@/domain/cheques/cartera";
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

/**
 * §4.4 Cheque rechazado.
 *
 * Lo que estos tests protegen es sobre todo lo que NO tiene que pasar. Es tentador
 * "arreglar" un rechazo reabriendo la deuda o revirtiendo el ahorro; la regla del
 * negocio es que lo levanta el vendedor y la verdulería no repone nada.
 */

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

async function escenarioEntregado() {
  const vendedor = await crearVendedor("Cheques del Sur");
  const proveedor = await crearProveedor();
  const factura = await crearFactura(proveedor.id, "A-001", "100000");

  const { cheque } = await comprarCheque({
    numero: "0001",
    banco: "Nación",
    librador: "Frutas del Valle SA",
    nominal: dec("100000"),
    porcentajeDescuento: dec("10"),
    fechaVencimiento: new Date("2026-12-01"),
    vendedorChequeId: vendedor.id,
  });

  await entregarCheque({
    chequeId: cheque.id,
    proveedorId: proveedor.id,
    imputaciones: [{ facturaProveedorId: factura.id, monto: dec("100000") }],
    fechaEntrega: new Date("2026-08-11T10:00:00Z"),
  });

  return { cheque, proveedor, factura, vendedor };
}

describe("rechazo después de la entrega", () => {
  it("marca el cheque con fecha y motivo", async () => {
    const { cheque } = await escenarioEntregado();

    const rechazado = await rechazarCheque({
      chequeId: cheque.id,
      motivo: "Sin fondos suficientes",
      fechaRechazo: new Date("2026-08-20"),
    });

    expect(rechazado.estado).toBe("rechazado");
    expect(rechazado.motivoRechazo).toBe("Sin fondos suficientes");
    expect(rechazado.fechaRechazo?.toISOString().slice(0, 10)).toBe("2026-08-20");
  });

  it("NO reabre la deuda con el proveedor (§4.4)", async () => {
    const { cheque, proveedor, factura } = await escenarioEntregado();

    const saldoAntes = (await proveedorRecargado(proveedor.id)).saldo.toString();
    await rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" });

    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe(saldoAntes);

    const facturaFinal = await facturaRecargada(factura.id);
    expect(facturaFinal.estado).toBe("pagada");
    expect(facturaFinal.saldoPendiente.toString()).toBe("0");
  });

  it("NO genera egreso de caja: la verdulería no repone dinero (§4.4)", async () => {
    const { cheque } = await escenarioEntregado();

    const antes = await movimientosDeCaja();
    await rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" });
    const despues = await movimientosDeCaja();

    expect(despues).toHaveLength(antes.length);
    expect(despues).toHaveLength(1); // solo la compra del cheque
  });

  it("NO revierte el ahorro ya realizado (§4.4)", async () => {
    const { cheque } = await escenarioEntregado();

    const antes = await ahorroRealizado(new Date("2026-08-01"), new Date("2026-08-31"));
    expect(antes.total.toString()).toBe("10000");

    await rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" });

    // Sigue contando: el proveedor ya cobró su deuda, quien repone es el vendedor.
    const despues = await ahorroRealizado(new Date("2026-08-01"), new Date("2026-08-31"));
    expect(despues.total.toString()).toBe("10000");
  });

  it("conserva las imputaciones para el historial", async () => {
    const { cheque } = await escenarioEntregado();
    await rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" });

    expect(await prisma.imputacionCheque.count({ where: { chequeId: cheque.id } })).toBe(1);
    expect(await prisma.pagoProveedor.count({ where: { chequeId: cheque.id } })).toBe(1);
  });
});

describe("historial de rechazos (§5.2)", () => {
  it("agrupa por librador y por vendedor", async () => {
    const { cheque, vendedor } = await escenarioEntregado();
    await rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" });

    const { porLibrador, porVendedor, rechazados } = await historialRechazos();

    expect(rechazados).toHaveLength(1);
    expect(porLibrador.get("Frutas del Valle SA")).toEqual({
      cantidad: 1,
      nominal: expect.objectContaining({}),
    });
    expect(porLibrador.get("Frutas del Valle SA")?.nominal.toString()).toBe("100000");
    expect(porVendedor.get(vendedor.nombre)?.cantidad).toBe(1);
  });
});

describe("validaciones", () => {
  it("un cheque en cartera no pudo rebotar: nadie lo depositó", async () => {
    const vendedor = await crearVendedor();
    const { cheque } = await comprarCheque({
      numero: "0002",
      banco: "Galicia",
      librador: "Otro Librador SRL",
      nominal: dec("50000"),
      porcentajeDescuento: dec("5"),
      fechaVencimiento: new Date("2026-12-01"),
      vendedorChequeId: vendedor.id,
    });

    expect(
      await codigoDelError(() =>
        rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" }),
      ),
    ).toBe("CHEQUE_NO_ENTREGADO");
  });

  it("no se rechaza dos veces el mismo cheque", async () => {
    const { cheque } = await escenarioEntregado();
    await rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" });

    expect(
      await codigoDelError(() =>
        rechazarCheque({ chequeId: cheque.id, motivo: "Otra vez" }),
      ),
    ).toBe("CHEQUE_YA_RECHAZADO");
  });
});
