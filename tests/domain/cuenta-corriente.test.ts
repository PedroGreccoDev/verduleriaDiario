import { beforeEach, describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import type { ErrorDominio } from "@/lib/errores";
import { abrirTurno, cerrarTurno } from "@/domain/caja/turno.service";
import {
  registrarCargoCliente,
  registrarPagoCliente,
  saldoALaFecha,
} from "@/domain/clientes/cuenta-corriente.service";
import { prisma } from "../setup";
import { crearCliente, movimientosDeCaja, sembrarCategorias } from "../factories";

/** §3.4 y §4: cuenta corriente de clientes (fiado). */

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

async function clienteRecargado(id: string) {
  return prisma.cliente.findUniqueOrThrow({ where: { id } });
}

async function movimientosDelCliente(clienteId: string) {
  return prisma.movimientoCuentaCorriente.findMany({
    where: { clienteId },
    orderBy: { fecha: "asc" },
  });
}

describe("fiar", () => {
  it("sube el saldo del cliente y deja el snapshot del movimiento", async () => {
    const cliente = await crearCliente();

    const { movimiento } = await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("12000"),
      observacion: "Cajón de tomate",
    });

    expect(movimiento.tipo).toBe("cargo");
    expect(movimiento.saldoResultante.toString()).toBe("12000");
    expect((await clienteRecargado(cliente.id)).saldo.toString()).toBe("12000");
  });

  it("NO mueve la caja: no entró ni salió efectivo", async () => {
    // El fiado es mercadería que se fue sin plata a cambio. Si generara un
    // movimiento de la Bolsa Grande, el reporte de §5.1 mostraría un egreso de
    // efectivo que nunca ocurrió y el arqueo del turno no cerraría.
    const cliente = await crearCliente();

    await registrarCargoCliente({ clienteId: cliente.id, monto: dec("12000") });

    expect(await movimientosDeCaja()).toHaveLength(0);
  });

  it("acumula varios cargos y cada snapshot refleja el saldo de ese momento", async () => {
    const cliente = await crearCliente();

    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("12000"),
      fecha: new Date("2026-08-10T10:00:00Z"),
    });
    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("8000"),
      fecha: new Date("2026-08-11T10:00:00Z"),
    });

    const movimientos = await movimientosDelCliente(cliente.id);

    expect(movimientos.map((m) => m.saldoResultante.toString())).toEqual([
      "12000",
      "20000",
    ]);
    expect((await clienteRecargado(cliente.id)).saldo.toString()).toBe("20000");
  });

  it("rechaza un monto que no es positivo", async () => {
    const cliente = await crearCliente();

    expect(
      await codigoDelError(() =>
        registrarCargoCliente({ clienteId: cliente.id, monto: dec("0") }),
      ),
    ).toBe("MONTO_INVALIDO");
  });

  it("rechaza un cliente que no existe", async () => {
    expect(
      await codigoDelError(() =>
        registrarCargoCliente({ clienteId: "cliente-inventado", monto: dec("12000") }),
      ),
    ).toBe("CLIENTE_NO_ENCONTRADO");
  });
});

describe("cobrar el fiado", () => {
  it("baja el saldo y entra la plata a la Bolsa Grande", async () => {
    const cliente = await crearCliente();
    await registrarCargoCliente({ clienteId: cliente.id, monto: dec("20000") });

    await registrarPagoCliente({ clienteId: cliente.id, monto: dec("15000") });

    expect((await clienteRecargado(cliente.id)).saldo.toString()).toBe("5000");

    const movimientos = await movimientosDeCaja();
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0].tipo).toBe("ingreso");
    expect(movimientos[0].categoria.slug).toBe("cobro_cuenta_corriente");
    expect(movimientos[0].monto.toString()).toBe("15000");
  });

  it("asocia el cobro al turno abierto", async () => {
    const cliente = await crearCliente();
    const turno = await abrirTurno({ nombre: "mañana", fecha: new Date("2026-08-11") });

    await registrarPagoCliente({ clienteId: cliente.id, monto: dec("15000") });

    expect((await movimientosDeCaja())[0].turnoId).toBe(turno.id);
  });

  it("si paga de más, el excedente queda como saldo a favor suyo", async () => {
    // Mismo criterio que con proveedores (§3.3): el saldo negativo ES el saldo a
    // favor, no un caso especial con su propia rama.
    const cliente = await crearCliente();
    await registrarCargoCliente({ clienteId: cliente.id, monto: dec("20000") });

    await registrarPagoCliente({ clienteId: cliente.id, monto: dec("25000") });

    expect((await clienteRecargado(cliente.id)).saldo.toString()).toBe("-5000");
  });

  it("rechaza un monto que no es positivo", async () => {
    const cliente = await crearCliente();

    expect(
      await codigoDelError(() =>
        registrarPagoCliente({ clienteId: cliente.id, monto: dec("-100") }),
      ),
    ).toBe("MONTO_INVALIDO");
  });

  it("sobre un turno cerrado no deja nada a medias", async () => {
    // El cobro toca tres tablas. Si el movimiento de caja falla por turno cerrado
    // (§4.1) y el resto quedara escrito, el cliente aparecería con la deuda saldada
    // sin que la plata haya entrado a ninguna caja.
    const cliente = await crearCliente();
    await registrarCargoCliente({ clienteId: cliente.id, monto: dec("20000") });

    const turno = await abrirTurno({ nombre: "mañana", fecha: new Date("2026-08-11") });
    await cerrarTurno({ turnoId: turno.id });

    expect(
      await codigoDelError(() =>
        registrarPagoCliente({
          clienteId: cliente.id,
          monto: dec("15000"),
          turnoId: turno.id,
        }),
      ),
    ).toBe("TURNO_CERRADO");

    expect((await clienteRecargado(cliente.id)).saldo.toString()).toBe("20000");
    expect(await movimientosDelCliente(cliente.id)).toHaveLength(1);
  });
});

describe("estado de cuenta a una fecha", () => {
  it("devuelve el saldo del último movimiento anterior o igual a la fecha", async () => {
    const cliente = await crearCliente();

    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("12000"),
      fecha: new Date("2026-08-10T10:00:00Z"),
    });
    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("8000"),
      fecha: new Date("2026-08-12T10:00:00Z"),
    });

    expect((await saldoALaFecha(cliente.id, new Date("2026-08-11T23:59:59Z")))?.toString()).toBe(
      "12000",
    );
    expect((await saldoALaFecha(cliente.id, new Date("2026-08-12T23:59:59Z")))?.toString()).toBe(
      "20000",
    );
  });

  it("devuelve null si a esa fecha el cliente todavía no tenía movimientos", async () => {
    // Null y no cero: "no había cuenta" no es lo mismo que "debía cero", y el
    // reporte de deudores tiene que poder distinguirlos.
    const cliente = await crearCliente();
    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("12000"),
      fecha: new Date("2026-08-10T10:00:00Z"),
    });

    expect(await saldoALaFecha(cliente.id, new Date("2026-08-01T00:00:00Z"))).toBeNull();
  });

  it("usa el snapshot y no recalcula la historia", async () => {
    // El saldo a una fecha sale de `saldo_resultante`, así que un cobro posterior
    // no puede cambiar lo que el cliente debía aquel día.
    const cliente = await crearCliente();
    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("12000"),
      fecha: new Date("2026-08-10T10:00:00Z"),
    });
    await registrarPagoCliente({
      clienteId: cliente.id,
      monto: dec("12000"),
      fecha: new Date("2026-08-13T10:00:00Z"),
    });

    expect((await saldoALaFecha(cliente.id, new Date("2026-08-10T23:59:59Z")))?.toString()).toBe(
      "12000",
    );
    expect((await saldoALaFecha(cliente.id, new Date("2026-08-13T23:59:59Z")))?.toString()).toBe(
      "0",
    );
  });
});
