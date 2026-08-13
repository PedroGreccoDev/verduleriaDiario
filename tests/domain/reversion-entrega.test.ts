import { beforeEach, describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import type { ErrorDominio } from "@/lib/errores";
import { comprarCheque } from "@/domain/cheques/compra.service";
import { entregarCheque } from "@/domain/cheques/entrega.service";
import { revertirEntregaCheque } from "@/domain/cheques/reversion.service";
import { rechazarCheque } from "@/domain/cheques/rechazo.service";
import { pagarProveedorEnEfectivo } from "@/domain/proveedores/pago.service";
import { ahorroRealizado, saldoCartera } from "@/domain/cheques/cartera";
import { prisma } from "../setup";
import {
  crearFactura,
  crearProveedor,
  crearVendedor,
  facturaRecargada,
  proveedorRecargado,
  sembrarCategorias,
} from "../factories";

/**
 * Revertir deshace los cinco pasos de §4.3 para corregir una entrega mal cargada.
 *
 * NO es el flujo del rebote: un cheque que rebota se registra con `rechazarCheque`
 * y no mueve ningún saldo, porque lo levanta quien vendió el cheque (§4.4). Los
 * dos casos se prueban acá justamente para dejar la diferencia fijada.
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

/** Cheque de nominal 100.000 comprado al 10%: pagado 90.000, ahorro 10.000. */
async function chequeEnCartera(nominal = "100000", numero = "0001") {
  const vendedor = await crearVendedor();
  const { cheque } = await comprarCheque({
    numero,
    banco: "Nación",
    librador: "Frutas del Valle SA",
    nominal: dec(nominal),
    porcentajeDescuento: dec("10"),
    fechaVencimiento: new Date("2026-12-01"),
    vendedorChequeId: vendedor.id,
  });
  return cheque;
}

describe("revertir deja todo como antes de la entrega", () => {
  it("devuelve el cheque a la cartera", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "80000");
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("80000") }],
    });

    const { cheque: revertido } = await revertirEntregaCheque({ chequeId: cheque.id });

    expect(revertido.estado).toBe("en_cartera");
    expect(revertido.fechaEntrega).toBeNull();
    expect(revertido.proveedorDestinoId).toBeNull();
  });

  it("las facturas vuelven a deber lo que el cheque les había saldado", async () => {
    const proveedor = await crearProveedor();
    const a = await crearFactura(proveedor.id, "A-001", "30000");
    const b = await crearFactura(proveedor.id, "A-002", "45000");
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [
        { facturaProveedorId: a.id, monto: dec("30000") },
        { facturaProveedorId: b.id, monto: dec("20000") },
      ],
    });

    await revertirEntregaCheque({ chequeId: cheque.id });

    const aFinal = await facturaRecargada(a.id);
    const bFinal = await facturaRecargada(b.id);

    expect(aFinal.saldoPendiente.toString()).toBe("30000");
    expect(aFinal.estado).toBe("pendiente");
    expect(bFinal.saldoPendiente.toString()).toBe("45000");
    expect(bFinal.estado).toBe("pendiente");
  });

  it("el proveedor vuelve a ser acreedor por el nominal completo", async () => {
    const proveedor = await crearProveedor();
    await crearFactura(proveedor.id, "A-001", "80000");
    const cheque = await chequeEnCartera();

    const saldoAntes = (await proveedorRecargado(proveedor.id)).saldo.toString();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [],
    });
    await revertirEntregaCheque({ chequeId: cheque.id });

    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe(saldoAntes);
  });

  it("borra el pago: el cheque no pagó nada", async () => {
    const proveedor = await crearProveedor();
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [],
    });
    expect(await prisma.pagoProveedor.count({ where: { chequeId: cheque.id } })).toBe(1);

    await revertirEntregaCheque({ chequeId: cheque.id });

    expect(await prisma.pagoProveedor.count({ where: { chequeId: cheque.id } })).toBe(0);
    expect(await prisma.imputacionCheque.count({ where: { chequeId: cheque.id } })).toBe(0);
  });

  it("el ahorro vuelve a ser latente y el cheque vuelve a contar en la cartera", async () => {
    const proveedor = await crearProveedor();
    const cheque = await chequeEnCartera();
    const fechaEntrega = new Date("2026-08-12");

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [],
      fechaEntrega,
    });

    expect((await ahorroRealizado(fechaEntrega, fechaEntrega)).total.toString()).toBe("10000");
    expect((await saldoCartera()).toString()).toBe("0");

    await revertirEntregaCheque({ chequeId: cheque.id });

    // El ahorro no se borra de ningún lado porque nunca se escribió: se deriva de
    // fecha_entrega, y al limpiarla deja de contarse solo.
    expect((await ahorroRealizado(fechaEntrega, fechaEntrega)).total.toString()).toBe("0");
    expect((await saldoCartera()).toString()).toBe("100000");
  });

  it("después de revertir se puede entregar de nuevo, a otro proveedor", async () => {
    const primero = await crearProveedor("Mercado Central");
    const segundo = await crearProveedor("Frutas del Sur");
    const factura = await crearFactura(segundo.id, "B-001", "100000");
    const cheque = await chequeEnCartera();

    await entregarCheque({ chequeId: cheque.id, proveedorId: primero.id, imputaciones: [] });
    await revertirEntregaCheque({ chequeId: cheque.id });

    const { cheque: reentregado } = await entregarCheque({
      chequeId: cheque.id,
      proveedorId: segundo.id,
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("100000") }],
    });

    expect(reentregado.proveedorDestinoId).toBe(segundo.id);
    expect((await facturaRecargada(factura.id)).estado).toBe("pagada");
    expect((await proveedorRecargado(primero.id)).saldo.toString()).toBe("0");
  });
});

describe("revertir y rechazar son cosas distintas", () => {
  it("revertir no marca el cheque como rechazado", async () => {
    const proveedor = await crearProveedor();
    const cheque = await chequeEnCartera();

    await entregarCheque({ chequeId: cheque.id, proveedorId: proveedor.id, imputaciones: [] });
    const { cheque: revertido } = await revertirEntregaCheque({ chequeId: cheque.id });

    expect(revertido.estado).toBe("en_cartera");
    expect(revertido.fechaRechazo).toBeNull();
  });

  /**
   * Son mutuamente excluyentes POR DISEÑO, no por descuido: si la entrega se
   * revirtió es porque nunca ocurrió, así que no hay nada que pueda haber rebotado.
   */
  it("no se puede rechazar un cheque cuya entrega se revirtió", async () => {
    const proveedor = await crearProveedor();
    const cheque = await chequeEnCartera();

    await entregarCheque({ chequeId: cheque.id, proveedorId: proveedor.id, imputaciones: [] });
    await revertirEntregaCheque({ chequeId: cheque.id });

    expect(
      await codigoDelError(() => rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" })),
    ).toBe("CHEQUE_NO_ENTREGADO");
  });
});

/**
 * El rebote NO pasa por la reversión (§4.4). Quien vendió el cheque lo levanta
 * pagándole directo al proveedor, así que la deuda queda saldada y el ahorro
 * sigue realizado. Estos tests son el candado: si alguien "arreglara" el rechazo
 * para que reabra la deuda, la verdulería empezaría a reclamarle al proveedor
 * plata que la financiera ya pagó.
 */
describe("un cheque que rebotó no toca ningún saldo", () => {
  it("la deuda con el proveedor queda saldada", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "100000");
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("100000") }],
    });

    const { estado } = await rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" });

    expect(estado).toBe("rechazado");
    // La factura sigue pagada y el proveedor sin deuda: lo levanta el vendedor.
    const facturaFinal = await facturaRecargada(factura.id);
    expect(facturaFinal.saldoPendiente.toString()).toBe("0");
    expect(facturaFinal.estado).toBe("pagada");
    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe("0");
  });

  it("el ahorro sigue realizado: el cheque canceló deuda igual", async () => {
    const proveedor = await crearProveedor();
    const cheque = await chequeEnCartera();
    const fechaEntrega = new Date("2026-08-12");

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [],
      fechaEntrega,
    });
    await rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" });

    // Las consultas de ahorro filtran por fecha_entrega y NO por estado, justamente
    // para que un rechazo posterior no borre un ahorro que sí ocurrió.
    expect((await ahorroRealizado(fechaEntrega, fechaEntrega)).total.toString()).toBe("10000");
  });

  it("el pago al proveedor sigue en pie", async () => {
    const proveedor = await crearProveedor();
    const cheque = await chequeEnCartera();

    await entregarCheque({ chequeId: cheque.id, proveedorId: proveedor.id, imputaciones: [] });
    await rechazarCheque({ chequeId: cheque.id, motivo: "Sin fondos" });

    expect(await prisma.pagoProveedor.count({ where: { chequeId: cheque.id } })).toBe(1);
  });
});

describe("qué no se puede revertir", () => {
  it("un cheque que nunca se entregó", async () => {
    const cheque = await chequeEnCartera();

    expect(await codigoDelError(() => revertirEntregaCheque({ chequeId: cheque.id }))).toBe(
      "CHEQUE_SIN_ENTREGA",
    );
  });

  it("un cheque que no existe", async () => {
    expect(await codigoDelError(() => revertirEntregaCheque({ chequeId: "no-existe" }))).toBe(
      "CHEQUE_NO_ENCONTRADO",
    );
  });

  it("no revierte dos veces la misma entrega", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "80000");
    const cheque = await chequeEnCartera();

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("80000") }],
    });
    await revertirEntregaCheque({ chequeId: cheque.id });

    // La segunda vez no encuentra entrega, así que no vuelve a sumarle el nominal
    // al proveedor. Sin esto, revertir dos veces le regalaría deuda de la nada.
    expect(await codigoDelError(() => revertirEntregaCheque({ chequeId: cheque.id }))).toBe(
      "CHEQUE_SIN_ENTREGA",
    );
    expect((await proveedorRecargado(proveedor.id)).saldo.toString()).toBe("80000");
  });
});

/**
 * Una factura pagada en parte con el cheque puede recibir después un pago en
 * efectivo. Revertir la entrega tiene que devolverle SOLO lo del cheque y dejar
 * el pago en efectivo intacto: son dos cobros distintos y uno no anula al otro.
 */
describe("reversión con pagos posteriores sobre la misma factura", () => {
  it("devuelve lo del cheque y respeta el pago en efectivo", async () => {
    const proveedor = await crearProveedor();
    const factura = await crearFactura(proveedor.id, "A-001", "100000");
    const cheque = await chequeEnCartera("60000");

    await entregarCheque({
      chequeId: cheque.id,
      proveedorId: proveedor.id,
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("60000") }],
    });
    await pagarProveedorEnEfectivo({
      proveedorId: proveedor.id,
      monto: dec("40000"),
      imputaciones: [{ facturaProveedorId: factura.id, monto: dec("40000") }],
    });

    expect((await facturaRecargada(factura.id)).estado).toBe("pagada");

    await revertirEntregaCheque({ chequeId: cheque.id });

    // Vuelve a deber los 60.000 del cheque; los 40.000 en efectivo siguen pagos.
    const facturaFinal = await facturaRecargada(factura.id);
    expect(facturaFinal.saldoPendiente.toString()).toBe("60000");
    expect(facturaFinal.estado).toBe("parcial");

    // El pago en efectivo no se tocó: solo desapareció el del cheque.
    const pagos = await prisma.pagoProveedor.findMany({ where: { proveedorId: proveedor.id } });
    expect(pagos).toHaveLength(1);
    expect(pagos[0].medio).toBe("efectivo");
  });
});
