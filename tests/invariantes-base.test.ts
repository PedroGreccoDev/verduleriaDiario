import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./setup";

/**
 * Estos tests no prueban lógica de dominio: prueban que las restricciones escritas
 * a mano en la migración están vivas en la base.
 *
 * Existen porque son la última línea de defensa. Si alguien agrega un camino nuevo
 * (un script, un seed, una consola) que se saltea la capa de dominio, esto es lo
 * único que impide que la base quede inconsistente. Si una migración futura las
 * borra por accidente, estos tests avisan.
 */

const dec = (v: string) => new Prisma.Decimal(v);

async function proveedorDePrueba() {
  return prisma.proveedor.create({ data: { nombre: "Proveedor de prueba" } });
}

async function vendedorDePrueba() {
  return prisma.vendedorCheque.create({ data: { nombre: "Vendedor de prueba" } });
}

const chequeBase = {
  numero: "0001",
  banco: "Nación",
  librador: "Librador SA",
  nominal: dec("100000"),
  porcentajeDescuento: dec("10"),
  montoPagado: dec("90000"),
  ahorro: dec("10000"),
  fechaVencimiento: new Date("2026-12-01"),
};

describe("Decimal", () => {
  it("guarda y devuelve Decimal, no punto flotante (§7.1)", async () => {
    const p = await prisma.proveedor.create({
      data: { nombre: "Decimal", saldo: dec("1234567.89") },
    });
    const leido = await prisma.proveedor.findUniqueOrThrow({ where: { id: p.id } });

    expect(Prisma.Decimal.isDecimal(leido.saldo)).toBe(true);
    expect(leido.saldo.toString()).toBe("1234567.89");
  });

  it("no pierde centavos en el cálculo de descuento por porcentaje", async () => {
    // 0.1 + 0.2 en Float da 0.30000000000000004. Con Decimal tiene que dar 0.3.
    const nominal = dec("33333.33");
    const pagado = nominal.mul(dec("1").minus(dec("12.5").div(100)));

    expect(pagado.toDecimalPlaces(2).toString()).toBe("29166.66");
  });
});

describe("turno", () => {
  it("rechaza dos turnos abiertos en simultáneo (§4.1)", async () => {
    await prisma.turno.create({
      data: { fecha: new Date("2026-08-11"), nombre: "mañana" },
    });

    await expect(
      prisma.turno.create({
        data: { fecha: new Date("2026-08-11"), nombre: "tarde" },
      }),
    ).rejects.toThrow();
  });

  it("permite abrir uno nuevo si el anterior está cerrado", async () => {
    const primero = await prisma.turno.create({
      data: { fecha: new Date("2026-08-11"), nombre: "mañana" },
    });
    await prisma.turno.update({
      where: { id: primero.id },
      data: { estado: "cerrado", fechaCierre: new Date() },
    });

    await expect(
      prisma.turno.create({
        data: { fecha: new Date("2026-08-11"), nombre: "tarde" },
      }),
    ).resolves.toBeDefined();
  });

  it("rechaza cerrar un turno sin fecha de cierre", async () => {
    const turno = await prisma.turno.create({
      data: { fecha: new Date("2026-08-11"), nombre: "mañana" },
    });

    await expect(
      prisma.turno.update({ where: { id: turno.id }, data: { estado: "cerrado" } }),
    ).rejects.toThrow();
  });
});

describe("movimiento_caja", () => {
  it("rechaza monto negativo o cero: el signo lo da `tipo` (§3.1)", async () => {
    const categoria = await prisma.categoriaMovimiento.create({
      data: { nombre: "Gasto operativo", slug: "gasto_operativo", tipo: "egreso" },
    });

    await expect(
      prisma.movimientoCaja.create({
        data: {
          tipo: "egreso",
          categoriaId: categoria.id,
          monto: dec("-500"),
          referenciaTipo: "gasto",
        },
      }),
    ).rejects.toThrow();
  });

  it("rechaza una categoría de ingreso en un movimiento de egreso", async () => {
    const categoria = await prisma.categoriaMovimiento.create({
      data: { nombre: "Aporte de socio", slug: "aporte_socio", tipo: "ingreso" },
    });

    await expect(
      prisma.movimientoCaja.create({
        data: {
          tipo: "egreso",
          categoriaId: categoria.id,
          monto: dec("500"),
          referenciaTipo: "manual",
        },
      }),
    ).rejects.toThrow(/no coincide/);
  });
});

describe("cheque", () => {
  it("rechaza un ahorro que no sea nominal − pagado", async () => {
    const vendedor = await vendedorDePrueba();

    await expect(
      prisma.cheque.create({
        data: {
          ...chequeBase,
          ahorro: dec("99999"), // mentira: debería ser 10000
          vendedorChequeId: vendedor.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("rechaza un monto pagado mayor al nominal", async () => {
    const vendedor = await vendedorDePrueba();

    await expect(
      prisma.cheque.create({
        data: {
          ...chequeBase,
          montoPagado: dec("120000"),
          ahorro: dec("-20000"),
          vendedorChequeId: vendedor.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("rechaza un cheque en cartera con fecha de entrega", async () => {
    const vendedor = await vendedorDePrueba();
    const proveedor = await proveedorDePrueba();

    await expect(
      prisma.cheque.create({
        data: {
          ...chequeBase,
          vendedorChequeId: vendedor.id,
          estado: "en_cartera",
          fechaEntrega: new Date(),
          proveedorDestinoId: proveedor.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("rechaza una entrega a medias: fecha sin proveedor destino", async () => {
    const vendedor = await vendedorDePrueba();

    await expect(
      prisma.cheque.create({
        data: {
          ...chequeBase,
          vendedorChequeId: vendedor.id,
          estado: "entregado",
          fechaEntrega: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it("rechaza cargar dos veces el mismo cheque", async () => {
    const vendedor = await vendedorDePrueba();
    await prisma.cheque.create({
      data: { ...chequeBase, vendedorChequeId: vendedor.id },
    });

    await expect(
      prisma.cheque.create({
        data: { ...chequeBase, vendedorChequeId: vendedor.id },
      }),
    ).rejects.toThrow();
  });
});

describe("factura_proveedor", () => {
  it("rechaza saldo pendiente negativo: el excedente va a proveedor.saldo (§3.3)", async () => {
    const proveedor = await proveedorDePrueba();

    await expect(
      prisma.facturaProveedor.create({
        data: {
          proveedorId: proveedor.id,
          numero: "A-1",
          fecha: new Date("2026-08-01"),
          montoTotal: dec("100000"),
          saldoPendiente: dec("-5000"),
        },
      }),
    ).rejects.toThrow();
  });

  it("rechaza un estado que contradiga el saldo pendiente", async () => {
    const proveedor = await proveedorDePrueba();

    await expect(
      prisma.facturaProveedor.create({
        data: {
          proveedorId: proveedor.id,
          numero: "A-2",
          fecha: new Date("2026-08-01"),
          montoTotal: dec("100000"),
          saldoPendiente: dec("100000"),
          estado: "pagada", // contradice: debe todo
        },
      }),
    ).rejects.toThrow();
  });
});

describe("proveedor", () => {
  it("admite saldo negativo: es saldo a favor, no un error (§3.3)", async () => {
    const proveedor = await prisma.proveedor.create({
      data: { nombre: "Con saldo a favor", saldo: dec("-15000.50") },
    });

    expect(proveedor.saldo.toString()).toBe("-15000.5");
    expect(proveedor.saldo.isNegative()).toBe(true);
  });
});

describe("pago_proveedor", () => {
  it("exige cheque_id cuando el medio es cheque (§3.3)", async () => {
    const proveedor = await proveedorDePrueba();

    await expect(
      prisma.pagoProveedor.create({
        data: { proveedorId: proveedor.id, medio: "cheque", monto: dec("50000") },
      }),
    ).rejects.toThrow();
  });

  it("prohíbe cheque_id cuando el medio es efectivo", async () => {
    const proveedor = await proveedorDePrueba();
    const vendedor = await vendedorDePrueba();
    const cheque = await prisma.cheque.create({
      data: { ...chequeBase, vendedorChequeId: vendedor.id },
    });

    await expect(
      prisma.pagoProveedor.create({
        data: {
          proveedorId: proveedor.id,
          medio: "efectivo",
          monto: dec("50000"),
          chequeId: cheque.id,
        },
      }),
    ).rejects.toThrow();
  });
});
