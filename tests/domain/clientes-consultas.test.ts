import { beforeEach, describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import type { ErrorDominio } from "@/lib/errores";
import { registrarCliente } from "@/domain/clientes/cliente.service";
import {
  registrarCargoCliente,
  registrarPagoCliente,
} from "@/domain/clientes/cuenta-corriente.service";
import { clientesConSaldo, cuentaDeCliente } from "@/domain/clientes/consultas";
import { crearCliente, sembrarCategorias } from "../factories";

/** §5.3 Deudores y estado de cuenta, y el alta de §3.4. */

beforeEach(async () => {
  await sembrarCategorias();
});

function soloFechaISO(fecha: Date | null): string | null {
  return fecha ? fecha.toISOString().slice(0, 10) : null;
}

describe("alta de cliente", () => {
  it("guarda el nombre sin espacios de más y el teléfono vacío como null", async () => {
    const cliente = await registrarCliente({ nombre: "  Rosa Giménez  ", telefono: "  " });

    expect(cliente.nombre).toBe("Rosa Giménez");
    expect(cliente.telefono).toBeNull();
    expect(cliente.saldo.toString()).toBe("0");
  });

  it("rechaza un nombre vacío", async () => {
    let codigo = "";
    try {
      await registrarCliente({ nombre: "   " });
    } catch (error) {
      codigo = (error as ErrorDominio).codigo;
    }

    expect(codigo).toBe("NOMBRE_REQUERIDO");
  });

  it("admite dos clientes con el mismo nombre", async () => {
    // En un barrio hay dos Rosas. La base no tiene unicidad sobre el nombre y el
    // alta no la inventa: bloquearía un alta legítima con el cliente esperando.
    await registrarCliente({ nombre: "Rosa", telefono: "11-1111" });
    await registrarCliente({ nombre: "Rosa", telefono: "11-2222" });

    expect(await clientesConSaldo()).toHaveLength(2);
  });
});

describe("listado de deudores", () => {
  it("incluye a los que no deben nada", async () => {
    // Sacarlos obligaría a buscarlos por otro lado justo cuando el cliente está
    // parado en el mostrador pidiendo fiado.
    await crearCliente("Sin deuda");

    const clientes = await clientesConSaldo();

    expect(clientes).toHaveLength(1);
    expect(clientes[0].saldo.toString()).toBe("0");
    expect(clientes[0].debeDesde).toBeNull();
  });

  it("la deuda corre desde el primer fiado impago, no desde el primero de la historia", async () => {
    // Si alguna vez saldó todo, la cuenta arrancó de nuevo ahí. Mostrar el fiado
    // de hace un año haría ver como moroso a quien debe de ayer.
    const cliente = await crearCliente();

    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("10000"),
      fecha: new Date("2026-06-01T10:00:00Z"),
    });
    await registrarPagoCliente({
      clienteId: cliente.id,
      monto: dec("10000"),
      fecha: new Date("2026-07-01T10:00:00Z"),
    });
    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("8000"),
      fecha: new Date("2026-08-10T10:00:00Z"),
    });

    const [encontrado] = await clientesConSaldo();

    expect(encontrado.saldo.toString()).toBe("8000");
    expect(soloFechaISO(encontrado.debeDesde)).toBe("2026-08-10");
  });

  it("el que saldó todo no arrastra deuda", async () => {
    // Para decimal.js el cero ES positivo, así que preguntar `saldo.isPositive()`
    // deja al cliente al día contado como deudor y con una fecha de deuda vieja.
    // Por eso el código usa `esPositivo`.
    const cliente = await crearCliente();

    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("10000"),
      fecha: new Date("2026-06-01T10:00:00Z"),
    });
    await registrarPagoCliente({
      clienteId: cliente.id,
      monto: dec("10000"),
      fecha: new Date("2026-07-01T10:00:00Z"),
    });

    const [encontrado] = await clientesConSaldo();

    expect(encontrado.saldo.toString()).toBe("0");
    expect(encontrado.debeDesde).toBeNull();
  });

  it("si nunca saldó, corre desde su primer movimiento", async () => {
    const cliente = await crearCliente();

    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("10000"),
      fecha: new Date("2026-06-01T10:00:00Z"),
    });
    await registrarPagoCliente({
      clienteId: cliente.id,
      monto: dec("4000"),
      fecha: new Date("2026-07-01T10:00:00Z"),
    });

    const [encontrado] = await clientesConSaldo();

    expect(soloFechaISO(encontrado.debeDesde)).toBe("2026-06-01");
  });

  it("quien pagó de más no tiene fecha de deuda", async () => {
    const cliente = await crearCliente();

    await registrarCargoCliente({ clienteId: cliente.id, monto: dec("10000") });
    await registrarPagoCliente({ clienteId: cliente.id, monto: dec("15000") });

    const [encontrado] = await clientesConSaldo();

    expect(encontrado.saldo.toString()).toBe("-5000");
    expect(encontrado.debeDesde).toBeNull();
  });
});

describe("estado de cuenta", () => {
  it("trae los movimientos del más nuevo al más viejo, con su saldo", async () => {
    const cliente = await crearCliente();

    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec("10000"),
      fecha: new Date("2026-08-01T10:00:00Z"),
    });
    await registrarPagoCliente({
      clienteId: cliente.id,
      monto: dec("4000"),
      fecha: new Date("2026-08-05T10:00:00Z"),
    });

    const cuenta = await cuentaDeCliente(cliente.id);

    expect(cuenta!.movimientos.map((m) => m.tipo)).toEqual(["pago", "cargo"]);
    expect(cuenta!.movimientos.map((m) => m.saldoResultante.toString())).toEqual([
      "6000",
      "10000",
    ]);
  });

  it("suma por separado lo que se llevó y lo que pagó", async () => {
    const cliente = await crearCliente();

    await registrarCargoCliente({ clienteId: cliente.id, monto: dec("10000") });
    await registrarCargoCliente({ clienteId: cliente.id, monto: dec("5000") });
    await registrarPagoCliente({ clienteId: cliente.id, monto: dec("4000") });

    const cuenta = await cuentaDeCliente(cliente.id);

    expect(cuenta!.totalFiado.toString()).toBe("15000");
    expect(cuenta!.totalPagado.toString()).toBe("4000");
    expect(cuenta!.cliente.saldo.toString()).toBe("11000");
  });

  it("devuelve null si el cliente no existe", async () => {
    expect(await cuentaDeCliente("cliente-inventado")).toBeNull();
  });
});
