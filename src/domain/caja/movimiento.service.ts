import type { PrismaTx } from "@/lib/prisma";
import type { Decimal } from "@/lib/decimal";
import { esPositivo, formatearMonto } from "@/lib/decimal";
import { errorDominio } from "@/lib/errores";
import type { ReferenciaMovimientoCaja } from "@/generated/prisma/enums";
import {
  obtenerCategoriaPorId,
  obtenerCategoriaPorSlug,
  type SlugCategoria,
} from "./categorias";

interface BaseMovimientoCaja {
  monto: Decimal;
  referenciaTipo: ReferenciaMovimientoCaja;
  referenciaId?: string | null;
  /**
   * Si se omite, el movimiento se asocia al turno abierto (si hay alguno).
   * Pasar `null` explícito lo deja fuera de turno: §3.1 lo permite.
   */
  turnoId?: string | null;
  fecha?: Date;
  observacion?: string | null;
  /**
   * Quién lo carga (§9). Lo pasa siempre la capa de Server Actions, que es la que
   * conoce la sesión: el dominio no sabe que existen las cookies.
   *
   * Es opcional porque el seed y los tests registran movimientos sin usuario, y
   * porque un movimiento sin autor es un estado legítimo — así quedó todo lo
   * cargado antes de que existieran los usuarios.
   */
  usuarioId?: string | null;
}

/**
 * La categoría se identifica por `slug` desde los flujos de §4 —que la conocen en
 * tiempo de compilación— y por `id` desde la carga manual, porque las categorías
 * que agregue el dueño no tienen un slug que el código pueda conocer.
 */
export type DatosMovimientoCaja = BaseMovimientoCaja &
  (
    | { categoriaSlug: SlugCategoria; categoriaId?: never }
    | { categoriaId: string; categoriaSlug?: never }
  );

/**
 * Registra un movimiento de la Bolsa Grande (§3.1).
 *
 * Único punto de escritura de `movimiento_caja`: todo lo que mueve efectivo pasa
 * por acá. Recibe `tx` y no abre transacción propia — quien lo llama ya está
 * dentro de una, porque ningún flujo mueve solo la caja.
 *
 * El tipo (ingreso/egreso) no se pasa: lo determina la categoría. Así es imposible
 * registrar un egreso con categoría de ingreso desde el dominio, que es lo mismo
 * que garantiza el trigger de la base.
 */
export async function registrarMovimientoCaja(tx: PrismaTx, datos: DatosMovimientoCaja) {
  if (!esPositivo(datos.monto)) {
    throw errorDominio(
      "MONTO_INVALIDO",
      `El monto de un movimiento de caja tiene que ser positivo; se recibió ${formatearMonto(datos.monto)}. ` +
        "El signo lo da el tipo del movimiento, no el monto.",
    );
  }

  const categoria = datos.categoriaSlug
    ? await obtenerCategoriaPorSlug(tx, datos.categoriaSlug)
    : await obtenerCategoriaPorId(tx, datos.categoriaId);
  const turnoId =
    datos.turnoId === undefined ? await idTurnoAbierto(tx) : datos.turnoId;

  if (turnoId) {
    await verificarTurnoAbierto(tx, turnoId);
  }

  return tx.movimientoCaja.create({
    data: {
      tipo: categoria.tipo,
      categoriaId: categoria.id,
      monto: datos.monto,
      referenciaTipo: datos.referenciaTipo,
      referenciaId: datos.referenciaId ?? null,
      turnoId,
      fecha: datos.fecha,
      observacion: datos.observacion ?? null,
      usuarioId: datos.usuarioId ?? null,
    },
  });
}

async function idTurnoAbierto(tx: PrismaTx): Promise<string | null> {
  const turno = await tx.turno.findFirst({ where: { estado: "abierto" } });
  return turno?.id ?? null;
}

/** §4.1: "No permitir movimientos sobre un turno cerrado". */
async function verificarTurnoAbierto(tx: PrismaTx, turnoId: string): Promise<void> {
  const turno = await tx.turno.findUnique({ where: { id: turnoId } });

  if (!turno) {
    throw errorDominio("TURNO_NO_ENCONTRADO", `No existe el turno ${turnoId}.`);
  }

  if (turno.estado === "cerrado") {
    throw errorDominio(
      "TURNO_CERRADO",
      `El turno del ${turno.fecha.toISOString().slice(0, 10)} (${turno.nombre}) está cerrado ` +
        "y no admite movimientos nuevos.",
    );
  }
}
