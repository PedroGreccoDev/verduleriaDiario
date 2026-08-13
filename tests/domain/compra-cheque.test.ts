import { beforeEach, describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import type { ErrorDominio } from "@/lib/errores";
import { comprarCheque } from "@/domain/cheques/compra.service";
import { previsualizarCompra } from "@/domain/cheques/calculo";
import { saldoCartera, costoCartera, ahorroRealizado } from "@/domain/cheques/cartera";
import { abrirTurno } from "@/domain/caja/turno.service";
import { crearVendedor, movimientosDeCaja, sembrarCategorias } from "../factories";

/** §4.2 Compra de cheque. */

beforeEach(async () => {
  await sembrarCategorias();
});

const compraBase = {
  numero: "00012345",
  banco: "Galicia",
  librador: "Distribuidora El Sol SRL",
  fechaVencimiento: new Date("2026-11-15"),
};

describe("cálculo", () => {
  it("el ejemplo del dueño: nominal 1000 al 10% se paga 900 y ahorra 100", () => {
    const calculo = previsualizarCompra(dec("1000"), dec("10"));

    expect(calculo.montoPagado.toString()).toBe("900");
    expect(calculo.ahorro.toString()).toBe("100");
  });

  it("ahorro + pagado siempre da el nominal, aun con porcentajes feos", () => {
    for (const porcentaje of ["7.35", "12.5", "3.33", "17.77", "0.01"]) {
      const nominal = dec("847532");
      const calculo = previsualizarCompra(nominal, dec(porcentaje));

      expect(calculo.montoPagado.plus(calculo.ahorro).toString()).toBe(nominal.toString());
    }
  });

  it("rechaza porcentajes fuera de rango", () => {
    expect(() => previsualizarCompra(dec("1000"), dec("-5"))).toThrow();
    expect(() => previsualizarCompra(dec("1000"), dec("100"))).toThrow();
    expect(() => previsualizarCompra(dec("1000"), dec("140"))).toThrow();
  });

  it("acepta 0% de descuento: es un cheque sin ahorro, no un error", () => {
    const calculo = previsualizarCompra(dec("1000"), dec("0"));

    expect(calculo.montoPagado.toString()).toBe("1000");
    expect(calculo.ahorro.toString()).toBe("0");
  });
});

describe("compra", () => {
  it("genera egreso de caja por lo PAGADO, no por el nominal (§2.3)", async () => {
    const vendedor = await crearVendedor();
    await abrirTurno({ nombre: "mañana" });

    const { cheque } = await comprarCheque({
      ...compraBase,
      nominal: dec("1000000"),
      porcentajeDescuento: dec("10"),
      vendedorChequeId: vendedor.id,
    });

    const [movimiento] = await movimientosDeCaja();

    expect(movimiento.tipo).toBe("egreso");
    expect(movimiento.categoria.slug).toBe("compra_cheques");
    expect(movimiento.monto.toString()).toBe("900000");
    expect(movimiento.monto.toString()).not.toBe(cheque.nominal.toString());
    expect(movimiento.referenciaId).toBe(cheque.id);
  });

  it("el cheque entra a cartera y NO registra ahorro todavía (§4.2)", async () => {
    const vendedor = await crearVendedor();

    const { cheque } = await comprarCheque({
      ...compraBase,
      nominal: dec("1000000"),
      porcentajeDescuento: dec("10"),
      vendedorChequeId: vendedor.id,
    });

    expect(cheque.estado).toBe("en_cartera");
    expect(cheque.fechaEntrega).toBeNull();
    expect(cheque.proveedorDestinoId).toBeNull();

    // El ahorro está calculado en el cheque, pero NO realizado: no hay entrega.
    expect(cheque.ahorro.toString()).toBe("100000");

    const ahorro = await ahorroRealizado(new Date("2026-01-01"), new Date("2026-12-31"));
    expect(ahorro.total.toString()).toBe("0");
    expect(ahorro.cantidadCheques).toBe(0);
  });

  it("la cartera se mide a nominal y no se mezcla con la Bolsa Grande (§2.1)", async () => {
    const vendedor = await crearVendedor();

    await comprarCheque({
      ...compraBase,
      nominal: dec("1000000"),
      porcentajeDescuento: dec("10"),
      vendedorChequeId: vendedor.id,
    });
    await comprarCheque({
      ...compraBase,
      numero: "00012346",
      nominal: dec("500000"),
      porcentajeDescuento: dec("8"),
      vendedorChequeId: vendedor.id,
    });

    // Cartera a nominal: 1.500.000. Costo real: 900.000 + 460.000 = 1.360.000.
    expect((await saldoCartera()).toString()).toBe("1500000");
    expect((await costoCartera()).toString()).toBe("1360000");

    // La caja solo vio salir el costo, nunca el nominal.
    const movimientos = await movimientosDeCaja();
    const totalEgresos = movimientos.reduce((acc, m) => acc.plus(m.monto), dec(0));
    expect(totalEgresos.toString()).toBe("1360000");
  });

  it("si falla el movimiento de caja no queda el cheque cargado", async () => {
    const vendedor = await crearVendedor();
    // Sin categorías sembradas, registrarMovimientoCaja falla.
    await import("../setup").then(({ prisma }) =>
      prisma.categoriaMovimiento.deleteMany({ where: { slug: "compra_cheques" } }),
    );

    let codigo = "";
    try {
      await comprarCheque({
        ...compraBase,
        nominal: dec("1000000"),
        porcentajeDescuento: dec("10"),
        vendedorChequeId: vendedor.id,
      });
    } catch (error) {
      codigo = (error as ErrorDominio).codigo;
    }

    expect(codigo).toBe("CATEGORIA_NO_ENCONTRADA");
    expect((await saldoCartera()).toString()).toBe("0");
  });
});
