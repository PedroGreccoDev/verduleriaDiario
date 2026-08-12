import { prisma, type PrismaTx } from "@/lib/prisma";
import { esPositivo, type Decimal } from "@/lib/decimal";
import { errorDominio } from "@/lib/errores";
import { registrarMovimientoCaja } from "@/domain/caja/movimiento.service";

/**
 * Cuenta corriente de clientes, o fiado: son lo mismo, un solo módulo (§6).
 *
 * Sin POS no hay venta que dispare el cargo: alguien lo registra a mano cuando
 * ocurre (§2.4). Por eso la carga tiene que ser de pocos campos, o no la van a usar.
 */

export interface DatosCargoCliente {
  clienteId: string;
  monto: Decimal;
  fecha?: Date;
  observacion?: string | null;
}

/**
 * Registra fiado: el cliente se lleva mercadería y queda debiendo.
 *
 * No genera movimiento de caja: no entró ni salió efectivo. La plata se mueve
 * recién cuando el cliente paga.
 */
export async function registrarCargoCliente(datos: DatosCargoCliente) {
  if (!esPositivo(datos.monto)) {
    throw errorDominio("MONTO_INVALIDO", "El monto del cargo tiene que ser mayor a cero.");
  }

  return prisma.$transaction(async (tx) => {
    const cliente = await obtenerCliente(tx, datos.clienteId);
    const saldoResultante = cliente.saldo.plus(datos.monto);

    // TODO(§8.3): el límite de crédito está sin definir. Sin POS no hay venta que
    //   bloquear, así que solo puede ser una advertencia al cargar el fiado o un
    //   dato informativo. Por ahora no bloquea nada: se calcula el excedente y se
    //   devuelve para que la UI decida si avisa.
    const limite = cliente.limiteCredito;
    const excedeLimite =
      limite !== null && limite.greaterThan(0) && saldoResultante.greaterThan(limite);

    const movimiento = await tx.movimientoCuentaCorriente.create({
      data: {
        clienteId: cliente.id,
        tipo: "cargo",
        monto: datos.monto,
        saldoResultante,
        referenciaTipo: "manual",
        fecha: datos.fecha,
        observacion: datos.observacion ?? null,
      },
    });

    const clienteActualizado = await tx.cliente.update({
      where: { id: cliente.id },
      data: { saldo: saldoResultante },
    });

    return { movimiento, cliente: clienteActualizado, excedeLimite };
  });
}

export interface DatosPagoCliente {
  clienteId: string;
  monto: Decimal;
  fecha?: Date;
  observacion?: string | null;
  /** Por defecto se asocia al turno abierto. `null` lo deja fuera de turno. */
  turnoId?: string | null;
}

/**
 * El cliente paga su fiado.
 *
 * Este SÍ genera movimiento de la Bolsa Grande: entra efectivo, categoría "Cobro
 * cuenta corriente" (§3.1). Toca dos tablas más el movimiento, así que va en
 * transacción.
 *
 * El saldo puede quedar negativo si paga de más; se trata como saldo a favor del
 * cliente, igual que con proveedores. No es un caso especial.
 */
export async function registrarPagoCliente(datos: DatosPagoCliente) {
  if (!esPositivo(datos.monto)) {
    throw errorDominio("MONTO_INVALIDO", "El monto del pago tiene que ser mayor a cero.");
  }

  const fecha = datos.fecha ?? new Date();

  return prisma.$transaction(async (tx) => {
    const cliente = await obtenerCliente(tx, datos.clienteId);
    const saldoResultante = cliente.saldo.minus(datos.monto);

    const movimiento = await tx.movimientoCuentaCorriente.create({
      data: {
        clienteId: cliente.id,
        tipo: "pago",
        monto: datos.monto,
        saldoResultante,
        referenciaTipo: "pago",
        fecha,
        observacion: datos.observacion ?? null,
      },
    });

    const clienteActualizado = await tx.cliente.update({
      where: { id: cliente.id },
      data: { saldo: saldoResultante },
    });

    const movimientoCaja = await registrarMovimientoCaja(tx, {
      categoriaSlug: "cobro_cuenta_corriente",
      monto: datos.monto,
      referenciaTipo: "cobro_cliente",
      referenciaId: movimiento.id,
      turnoId: datos.turnoId,
      fecha,
      observacion: datos.observacion ?? `Cobro a ${cliente.nombre}`,
    });

    return { movimiento, movimientoCaja, cliente: clienteActualizado };
  });
}

/**
 * Estado de cuenta a una fecha, reconstruido desde `saldo_resultante` (§3.4).
 * No recalcula la historia: toma el snapshot del último movimiento anterior o
 * igual a la fecha pedida.
 */
export async function saldoALaFecha(clienteId: string, fecha: Date) {
  const ultimo = await prisma.movimientoCuentaCorriente.findFirst({
    where: { clienteId, fecha: { lte: fecha } },
    orderBy: { fecha: "desc" },
  });

  return ultimo?.saldoResultante ?? null;
}

async function obtenerCliente(tx: PrismaTx, clienteId: string) {
  const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });

  if (!cliente) {
    throw errorDominio("CLIENTE_NO_ENCONTRADO", `No existe el cliente ${clienteId}.`);
  }

  return cliente;
}
