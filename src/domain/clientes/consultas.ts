import { prisma } from "@/lib/prisma";
import { CERO, esPositivo, type Decimal } from "@/lib/decimal";

/** Consultas de lectura para las pantallas de clientes (§5.3). Sin efectos. */

export interface ClienteConSaldo {
  id: string;
  nombre: string;
  telefono: string | null;
  /** Positivo = debe. Negativo = pagó de más y tiene saldo a favor. */
  saldo: Decimal;
  /**
   * Desde cuándo arrastra la deuda actual: la fecha del primer movimiento
   * posterior a la última vez que quedó en cero. `null` si no debe nada.
   */
  debeDesde: Date | null;
  ultimoMovimiento: Date | null;
}

/**
 * Todos los clientes activos con su situación (§5.3).
 *
 * Incluye a los que no deben: el fiado es una relación que sigue existiendo
 * aunque hoy esté en cero, y sacarlos de la lista obligaría a buscarlos por otro
 * lado justo cuando el cliente está parado en el mostrador pidiendo fiado.
 *
 * La antigüedad se calcula en memoria sobre los movimientos de los que deben. Son
 * los clientes de una verdulería, no un padrón: traer sus movimientos cuesta menos
 * que dos consultas por cliente, y evita una vista o un campo desnormalizado que
 * habría que mantener en sincronía.
 */
export async function clientesConSaldo(): Promise<ClienteConSaldo[]> {
  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    include: { movimientos: { orderBy: { fecha: "asc" } } },
    orderBy: { nombre: "asc" },
  });

  return clientes.map((cliente) => {
    const movimientos = cliente.movimientos;

    return {
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      saldo: cliente.saldo,
      debeDesde: esPositivo(cliente.saldo) ? inicioDeLaDeuda(movimientos) : null,
      ultimoMovimiento: movimientos.at(-1)?.fecha ?? null,
    };
  });
}

/**
 * Desde cuándo corre la deuda que el cliente tiene HOY.
 *
 * No es la fecha del primer fiado de su historia: si alguna vez saldó todo, la
 * cuenta arrancó de nuevo ahí. Se busca el último movimiento que dejó el saldo en
 * cero o a favor, y la deuda corre desde el siguiente. Mostrar la fecha del primer
 * fiado de siempre haría ver como moroso de dos años a alguien que debe de ayer.
 *
 * Se usa `esPositivo` y no `isPositive()`: para decimal.js el cero ES positivo, y
 * el saldo en cero es justamente el corte que hay que detectar acá.
 */
function inicioDeLaDeuda(
  movimientos: readonly { fecha: Date; saldoResultante: Decimal }[],
): Date | null {
  for (let i = movimientos.length - 1; i >= 0; i--) {
    if (!esPositivo(movimientos[i].saldoResultante)) {
      return movimientos[i + 1]?.fecha ?? null;
    }
  }

  return movimientos[0]?.fecha ?? null;
}

export interface MovimientoDeCuenta {
  id: string;
  fecha: Date;
  tipo: "cargo" | "pago";
  monto: Decimal;
  saldoResultante: Decimal;
  observacion: string | null;
}

export interface CuentaCliente {
  cliente: { id: string; nombre: string; telefono: string | null; saldo: Decimal; activo: boolean };
  /** Lo más reciente primero. */
  movimientos: MovimientoDeCuenta[];
  totalFiado: Decimal;
  totalPagado: Decimal;
  debeDesde: Date | null;
}

/**
 * Estado de cuenta de un cliente (§3.4).
 *
 * Los movimientos van con su `saldoResultante`, que es el snapshot de cómo quedó
 * la cuenta después de cada uno: es lo que le muestra al cliente que reclama, sin
 * tener que rehacer la suma delante suyo.
 */
export async function cuentaDeCliente(clienteId: string): Promise<CuentaCliente | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: { movimientos: { orderBy: { fecha: "asc" } } },
  });

  if (!cliente) return null;

  let totalFiado = CERO;
  let totalPagado = CERO;

  for (const movimiento of cliente.movimientos) {
    if (movimiento.tipo === "cargo") {
      totalFiado = totalFiado.plus(movimiento.monto);
    } else {
      totalPagado = totalPagado.plus(movimiento.monto);
    }
  }

  return {
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      saldo: cliente.saldo,
      activo: cliente.activo,
    },
    movimientos: cliente.movimientos
      .map((m) => ({
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: m.monto,
        saldoResultante: m.saldoResultante,
        observacion: m.observacion,
      }))
      .reverse(),
    totalFiado,
    totalPagado,
    debeDesde: esPositivo(cliente.saldo) ? inicioDeLaDeuda(cliente.movimientos) : null,
  };
}
