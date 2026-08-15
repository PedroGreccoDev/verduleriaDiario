import { beforeEach, describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import { registrarMovimientoCaja } from "@/domain/caja/movimiento.service";
import { abrirTurno } from "@/domain/caja/turno.service";
import { periodoDe, periodoPersonalizado } from "@/domain/caja/periodo";
import {
  categoriasParaFiltrar,
  reporteIngresosEgresos,
} from "@/domain/caja/reportes";
import { prisma } from "../setup";
import { sembrarCategorias } from "../factories";

/** §5.1 Reporte de ingresos y egresos. */

beforeEach(async () => {
  await sembrarCategorias();
});

async function movimiento(
  categoriaSlug: "gasto_operativo" | "retiro_turno" | "cobro_cuenta_corriente",
  monto: string,
  fecha: Date,
) {
  return prisma.$transaction((tx) =>
    registrarMovimientoCaja(tx, {
      categoriaSlug,
      monto: dec(monto),
      referenciaTipo: "gasto",
      fecha,
      turnoId: null,
    }),
  );
}

describe("qué entra en el período", () => {
  it("toma el día entero, incluida la última hora", async () => {
    // El corte de arriba es exclusivo: 23:59 del día pedido entra, 00:00 del
    // siguiente no. Sin esto el turno tarde se perdería del reporte del día.
    await movimiento("gasto_operativo", "1000", new Date(2026, 7, 13, 23, 59));
    await movimiento("gasto_operativo", "2000", new Date(2026, 7, 14, 0, 1));
    await movimiento("gasto_operativo", "4000", new Date(2026, 7, 14, 23, 59));
    await movimiento("gasto_operativo", "8000", new Date(2026, 7, 15, 0, 0));

    const reporte = await reporteIngresosEgresos({
      periodo: periodoDe("dia", new Date(2026, 7, 14, 10, 0)),
    });

    expect(reporte.movimientos.map((m) => m.monto.toString()).sort()).toEqual([
      "2000",
      "4000",
    ]);
    expect(reporte.totalEgresos.toString()).toBe("6000");
  });

  it("un rango personalizado incluye entero el último día", async () => {
    await movimiento("gasto_operativo", "5000", new Date(2026, 7, 14, 20, 0));

    const periodo = periodoPersonalizado("2026-08-01", "2026-08-14")!;
    const reporte = await reporteIngresosEgresos({ periodo });

    expect(reporte.movimientos).toHaveLength(1);
  });
});

describe("totales", () => {
  it("separa ingresos de egresos y el neto es la resta", async () => {
    await movimiento("cobro_cuenta_corriente", "50000", new Date(2026, 7, 14, 9, 0));
    await movimiento("retiro_turno", "30000", new Date(2026, 7, 14, 13, 0));
    await movimiento("gasto_operativo", "20000", new Date(2026, 7, 14, 18, 0));

    const reporte = await reporteIngresosEgresos({
      periodo: periodoDe("dia", new Date(2026, 7, 14)),
    });

    expect(reporte.totalIngresos.toString()).toBe("80000");
    expect(reporte.totalEgresos.toString()).toBe("20000");
    expect(reporte.neto.toString()).toBe("60000");
  });

  it("el neto puede ser negativo sin que la caja esté vacía", async () => {
    // El neto mide el período, no el saldo: la plata de días anteriores no cuenta
    // acá. Un neto negativo es "se gastó más de lo que entró esta semana", no
    // "la Bolsa Grande está en rojo".
    await movimiento("gasto_operativo", "20000", new Date(2026, 7, 14, 18, 0));

    const reporte = await reporteIngresosEgresos({
      periodo: periodoDe("dia", new Date(2026, 7, 14)),
    });

    expect(reporte.neto.toString()).toBe("-20000");
  });

  it("un período sin movimientos da cero y no rompe", async () => {
    const reporte = await reporteIngresosEgresos({
      periodo: periodoDe("mes", new Date(2020, 0, 15)),
    });

    expect(reporte.movimientos).toHaveLength(0);
    expect(reporte.totalIngresos.toString()).toBe("0");
    expect(reporte.neto.toString()).toBe("0");
  });
});

describe("filtros", () => {
  it("por tipo deja solo los egresos", async () => {
    await movimiento("cobro_cuenta_corriente", "50000", new Date(2026, 7, 14, 9, 0));
    await movimiento("gasto_operativo", "20000", new Date(2026, 7, 14, 18, 0));

    const reporte = await reporteIngresosEgresos({
      periodo: periodoDe("dia", new Date(2026, 7, 14)),
      tipo: "egreso",
    });

    expect(reporte.movimientos).toHaveLength(1);
    expect(reporte.totalIngresos.toString()).toBe("0");
    expect(reporte.totalEgresos.toString()).toBe("20000");
  });

  it("por categoría deja solo esa", async () => {
    await movimiento("cobro_cuenta_corriente", "50000", new Date(2026, 7, 14, 9, 0));
    await movimiento("retiro_turno", "30000", new Date(2026, 7, 14, 13, 0));

    const categorias = await categoriasParaFiltrar();
    const retiro = categorias.find((c) => c.nombre === "Retiro de turno")!;

    const reporte = await reporteIngresosEgresos({
      periodo: periodoDe("dia", new Date(2026, 7, 14)),
      categoriaId: retiro.id,
    });

    expect(reporte.movimientos.map((m) => m.monto.toString())).toEqual(["30000"]);
  });
});

describe("turno", () => {
  it("muestra a qué turno pertenece cada movimiento, y cuáles no tienen", async () => {
    const turno = await abrirTurno({ nombre: "mañana", fecha: new Date(2026, 7, 14) });

    await prisma.$transaction((tx) =>
      registrarMovimientoCaja(tx, {
        categoriaSlug: "gasto_operativo",
        monto: dec("1000"),
        referenciaTipo: "gasto",
        fecha: new Date(2026, 7, 14, 10, 0),
        turnoId: turno.id,
      }),
    );
    await movimiento("gasto_operativo", "2000", new Date(2026, 7, 14, 11, 0));

    const reporte = await reporteIngresosEgresos({
      periodo: periodoDe("dia", new Date(2026, 7, 14)),
    });

    const porMonto = new Map(reporte.movimientos.map((m) => [m.monto.toString(), m]));
    expect(porMonto.get("1000")?.turno?.nombre).toBe("mañana");
    expect(porMonto.get("2000")?.turno).toBeNull();
  });
});
