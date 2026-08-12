import { beforeEach, describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import type { ErrorDominio } from "@/lib/errores";
import { abrirTurno, cerrarTurno, obtenerTurnoAbierto } from "@/domain/caja/turno.service";
import { registrarRetiroParcial } from "@/domain/caja/retiro.service";
import { registrarMovimientoCaja } from "@/domain/caja/movimiento.service";
import { prisma } from "../setup";
import { movimientosDeCaja, sembrarCategorias } from "../factories";

/** §4.1 Apertura y cierre de turno, y retiros. */

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

describe("apertura", () => {
  it("abre un turno y queda como el turno abierto", async () => {
    const turno = await abrirTurno({ nombre: "mañana", fecha: new Date("2026-08-11") });

    expect(turno.estado).toBe("abierto");
    expect(turno.fechaCierre).toBeNull();
    expect((await obtenerTurnoAbierto())?.id).toBe(turno.id);
  });

  it("no permite dos turnos abiertos el mismo día", async () => {
    await abrirTurno({ nombre: "mañana", fecha: new Date("2026-08-11") });

    expect(
      await codigoDelError(() =>
        abrirTurno({ nombre: "tarde", fecha: new Date("2026-08-11") }),
      ),
    ).toBe("TURNO_YA_ABIERTO");
  });

  it("distingue el turno del día anterior que quedó sin cerrar", async () => {
    await abrirTurno({ nombre: "tarde", fecha: new Date("2026-08-10") });

    expect(
      await codigoDelError(() =>
        abrirTurno({ nombre: "mañana", fecha: new Date("2026-08-11") }),
      ),
    ).toBe("TURNO_ANTERIOR_SIN_CERRAR");
  });

  it("permite abrir el turno tarde después de cerrar el de la mañana", async () => {
    const mañana = await abrirTurno({ nombre: "mañana", fecha: new Date("2026-08-11") });
    await cerrarTurno({ turnoId: mañana.id });

    const tarde = await abrirTurno({ nombre: "tarde", fecha: new Date("2026-08-11") });
    expect(tarde.estado).toBe("abierto");
  });

  it("guarda la fecha del día local, sin correrse por la zona horaria", async () => {
    // 21:00 en Argentina (UTC−3) del 11 de agosto es el 12 en UTC. El turno tarde
    // tiene que quedar con fecha del 11, o los reportes por día dan mal.
    const turno = await abrirTurno({
      nombre: "tarde",
      fecha: new Date(2026, 7, 11, 21, 30),
    });

    expect(turno.fecha.toISOString().slice(0, 10)).toBe("2026-08-11");
  });
});

describe("retiros", () => {
  it("un retiro es un INGRESO a la Bolsa Grande (§2.2)", async () => {
    const turno = await abrirTurno({ nombre: "mañana" });
    await registrarRetiroParcial({ turnoId: turno.id, monto: dec("45000") });

    const [movimiento] = await movimientosDeCaja();
    expect(movimiento.tipo).toBe("ingreso");
    expect(movimiento.categoria.slug).toBe("retiro_turno");
    expect(movimiento.monto.toString()).toBe("45000");
    expect(movimiento.turnoId).toBe(turno.id);
  });

  it("admite varios retiros parciales en el mismo turno (§4.1)", async () => {
    const turno = await abrirTurno({ nombre: "mañana" });

    await registrarRetiroParcial({ turnoId: turno.id, monto: dec("30000") });
    await registrarRetiroParcial({ turnoId: turno.id, monto: dec("25500.50") });
    await registrarRetiroParcial({ turnoId: turno.id, monto: dec("12000") });

    const movimientos = await movimientosDeCaja();
    expect(movimientos).toHaveLength(3);

    const { _sum } = await prisma.movimientoCaja.aggregate({
      where: { turnoId: turno.id },
      _sum: { monto: true },
    });
    expect(_sum.monto?.toString()).toBe("67500.5");
  });

  it("suma el retiro de cierre a los parciales previos", async () => {
    const turno = await abrirTurno({ nombre: "tarde" });
    await registrarRetiroParcial({ turnoId: turno.id, monto: dec("30000") });

    await cerrarTurno({ turnoId: turno.id, montoRetiro: dec("18000") });

    const movimientos = await movimientosDeCaja();
    expect(movimientos).toHaveLength(2);
    expect(movimientos.map((m) => m.monto.toString())).toEqual(["30000", "18000"]);
  });

  it("rechaza un monto negativo", async () => {
    const turno = await abrirTurno({ nombre: "mañana" });

    expect(
      await codigoDelError(() =>
        registrarRetiroParcial({ turnoId: turno.id, monto: dec("-100") }),
      ),
    ).toBe("MONTO_INVALIDO");
  });
});

describe("cierre", () => {
  it("cierra sin retiro si ya se retiró todo antes", async () => {
    const turno = await abrirTurno({ nombre: "mañana" });
    await registrarRetiroParcial({ turnoId: turno.id, monto: dec("50000") });

    const cerrado = await cerrarTurno({ turnoId: turno.id });

    expect(cerrado.estado).toBe("cerrado");
    expect(cerrado.fechaCierre).not.toBeNull();
    expect(await movimientosDeCaja()).toHaveLength(1);
  });

  it("no admite movimientos sobre un turno cerrado (§4.1)", async () => {
    const turno = await abrirTurno({ nombre: "mañana" });
    await cerrarTurno({ turnoId: turno.id });

    expect(
      await codigoDelError(() =>
        registrarRetiroParcial({ turnoId: turno.id, monto: dec("10000") }),
      ),
    ).toBe("TURNO_CERRADO");
  });

  it("no se puede cerrar dos veces", async () => {
    const turno = await abrirTurno({ nombre: "mañana" });
    await cerrarTurno({ turnoId: turno.id });

    expect(await codigoDelError(() => cerrarTurno({ turnoId: turno.id }))).toBe(
      "TURNO_CERRADO",
    );
  });

  it("si el retiro de cierre falla, el turno queda abierto", async () => {
    const turno = await abrirTurno({ nombre: "mañana" });

    await expect(
      cerrarTurno({ turnoId: turno.id, montoRetiro: dec("-5000") }),
    ).rejects.toThrow();

    // El monto negativo hace fallar el retiro; la transacción revierte el cierre.
    const recargado = await prisma.turno.findUniqueOrThrow({ where: { id: turno.id } });
    expect(recargado.estado).toBe("abierto");
    expect(await movimientosDeCaja()).toHaveLength(0);
  });
});

describe("movimientos fuera de turno", () => {
  it("permite un gasto sin turno abierto (§3.1: turno_id es nullable)", async () => {
    const movimiento = await prisma.$transaction((tx) =>
      registrarMovimientoCaja(tx, {
        categoriaSlug: "gasto_operativo",
        monto: dec("8000"),
        referenciaTipo: "gasto",
        observacion: "Reparación de balanza",
      }),
    );

    expect(movimiento.turnoId).toBeNull();
    expect(movimiento.tipo).toBe("egreso");
  });

  it("asocia el movimiento al turno abierto cuando hay uno", async () => {
    const turno = await abrirTurno({ nombre: "mañana" });

    const movimiento = await prisma.$transaction((tx) =>
      registrarMovimientoCaja(tx, {
        categoriaSlug: "gasto_operativo",
        monto: dec("8000"),
        referenciaTipo: "gasto",
      }),
    );

    expect(movimiento.turnoId).toBe(turno.id);
  });
});
