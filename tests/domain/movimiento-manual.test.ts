import { beforeEach, describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import type { ErrorDominio } from "@/lib/errores";
import { abrirTurno, cerrarTurno } from "@/domain/caja/turno.service";
import { categoriasCargables } from "@/domain/caja/categorias";
import { registrarMovimientoManual } from "@/domain/caja/movimiento-manual.service";
import { prisma } from "../setup";
import { movimientosDeCaja, sembrarCategorias } from "../factories";

/** §3.1 Gastos e ingresos cargados a mano. */

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

async function categoriaPorSlug(slug: string) {
  return prisma.categoriaMovimiento.findUniqueOrThrow({ where: { slug } });
}

describe("qué se puede cargar a mano", () => {
  it("ofrece las que no genera ningún flujo", async () => {
    const cargables = await categoriasCargables(prisma);

    expect(cargables.map((c) => c.slug).sort()).toEqual([
      "aporte_socio",
      "gasto_operativo",
      "retiro_socio",
    ]);
  });

  it("incluye las que agregue el dueño, que no las genera nada", async () => {
    // §3.1: la tabla existe para que pueda sumar categorías sin tocar el código.
    await prisma.categoriaMovimiento.create({
      data: { slug: "alquiler", nombre: "Alquiler del local", tipo: "egreso", orden: 80 },
    });

    const cargables = await categoriasCargables(prisma);

    expect(cargables.map((c) => c.slug)).toContain("alquiler");
  });

  it.each([
    "retiro_turno",
    "cobro_cuenta_corriente",
    "compra_cheques",
    "pago_proveedor_efectivo",
  ])("rechaza %s, que la escribe su propio flujo", async (slug) => {
    // Cargarlas sueltas anotaría la plata sin el hecho que la explica: un cobro que
    // no le baja la deuda a ningún cliente, un pago que no salda ninguna factura.
    const categoria = await categoriaPorSlug(slug);

    expect(
      await codigoDelError(() =>
        registrarMovimientoManual({ categoriaId: categoria.id, monto: dec("8000") }),
      ),
    ).toBe("CATEGORIA_NO_CARGABLE");

    expect(await movimientosDeCaja()).toHaveLength(0);
  });
});

describe("registrar", () => {
  it("un gasto sale egreso porque lo dice la categoría", async () => {
    // El operador no elige ingreso o egreso en ningún lado: elige "Gasto operativo".
    // Es lo que impide cargar una nafta como ingreso.
    const categoria = await categoriaPorSlug("gasto_operativo");

    const movimiento = await registrarMovimientoManual({
      categoriaId: categoria.id,
      monto: dec("8000"),
      observacion: "Nafta de la camioneta",
    });

    expect(movimiento.tipo).toBe("egreso");
    expect(movimiento.monto.toString()).toBe("8000");
    expect(movimiento.referenciaTipo).toBe("manual");
    expect(movimiento.referenciaId).toBeNull();
  });

  it("un aporte de socio sale ingreso", async () => {
    const categoria = await categoriaPorSlug("aporte_socio");

    const movimiento = await registrarMovimientoManual({
      categoriaId: categoria.id,
      monto: dec("500000"),
    });

    expect(movimiento.tipo).toBe("ingreso");
  });

  it("se asocia al turno abierto", async () => {
    const categoria = await categoriaPorSlug("gasto_operativo");
    const turno = await abrirTurno({ nombre: "mañana", fecha: new Date("2026-08-11") });

    const movimiento = await registrarMovimientoManual({
      categoriaId: categoria.id,
      monto: dec("8000"),
    });

    expect(movimiento.turnoId).toBe(turno.id);
  });

  it("sin turno abierto queda fuera de turno (§3.1)", async () => {
    // La nafta se paga a las 7 de la mañana, antes de que nadie abra la caja.
    const categoria = await categoriaPorSlug("gasto_operativo");

    const movimiento = await registrarMovimientoManual({
      categoriaId: categoria.id,
      monto: dec("8000"),
    });

    expect(movimiento.turnoId).toBeNull();
  });

  it("no admite cargarlo sobre un turno cerrado", async () => {
    const categoria = await categoriaPorSlug("gasto_operativo");
    const turno = await abrirTurno({ nombre: "mañana", fecha: new Date("2026-08-11") });
    await cerrarTurno({ turnoId: turno.id });

    expect(
      await codigoDelError(() =>
        registrarMovimientoManual({
          categoriaId: categoria.id,
          monto: dec("8000"),
          turnoId: turno.id,
        }),
      ),
    ).toBe("TURNO_CERRADO");
  });

  it("rechaza un monto que no es positivo", async () => {
    const categoria = await categoriaPorSlug("gasto_operativo");

    expect(
      await codigoDelError(() =>
        registrarMovimientoManual({ categoriaId: categoria.id, monto: dec("0") }),
      ),
    ).toBe("MONTO_INVALIDO");
  });

  it("rechaza una categoría que no existe", async () => {
    expect(
      await codigoDelError(() =>
        registrarMovimientoManual({ categoriaId: "no-existe", monto: dec("8000") }),
      ),
    ).toBe("CATEGORIA_NO_ENCONTRADA");
  });
});
