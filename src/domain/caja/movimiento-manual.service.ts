import { prisma } from "@/lib/prisma";
import type { Decimal } from "@/lib/decimal";
import { errorDominio } from "@/lib/errores";
import { esCategoriaDeFlujo, obtenerCategoriaPorId } from "./categorias";
import { registrarMovimientoCaja } from "./movimiento.service";

export interface DatosMovimientoManual {
  categoriaId: string;
  monto: Decimal;
  observacion?: string | null;
  fecha?: Date;
  /** Por defecto se asocia al turno abierto. `null` lo deja fuera de turno. */
  turnoId?: string | null;
  /** Quién lo carga (§9). */
  usuarioId?: string | null;
}

/**
 * Gasto o ingreso cargado a mano (§3.1).
 *
 * Es el único movimiento de la Bolsa Grande que no lo dispara otro flujo: la
 * nafta de la camioneta, el arreglo de la balanza, la plata que pone o saca un
 * socio. Sin POS, todo eso lo anota alguien cuando ocurre (§2.4).
 *
 * **El tipo no se elige: lo determina la categoría.** El operador no marca
 * "ingreso" o "egreso" en ningún lado — elige "Gasto operativo" y el movimiento
 * sale egreso. Es la misma garantía que da el trigger de la base, y evita el error
 * de cargar una nafta como ingreso.
 *
 * Se rechazan las categorías que escribe un flujo. Registrar a mano un "Cobro
 * cuenta corriente" anotaría plata que entró sin bajarle la deuda a ningún
 * cliente, y la caja dejaría de coincidir con las cuentas.
 *
 * Va en transacción aunque toque una sola tabla, porque `registrarMovimientoCaja`
 * —el único punto de escritura de `movimiento_caja`— exige estar dentro de una.
 */
export async function registrarMovimientoManual(datos: DatosMovimientoManual) {
  return prisma.$transaction(async (tx) => {
    const categoria = await obtenerCategoriaPorId(tx, datos.categoriaId);

    if (esCategoriaDeFlujo(categoria.slug)) {
      throw errorDominio(
        "CATEGORIA_NO_CARGABLE",
        `"${categoria.nombre}" la registra el sistema cuando ocurre la operación, ` +
          "así que no se carga a mano.",
      );
    }

    return registrarMovimientoCaja(tx, {
      categoriaId: categoria.id,
      monto: datos.monto,
      // No hay entidad detrás: el papel que respalda este movimiento está en la
      // observación y en la cabeza del que lo cargó, no en otra tabla.
      referenciaTipo: "manual",
      turnoId: datos.turnoId,
      fecha: datos.fecha,
      observacion: datos.observacion ?? null,
      usuarioId: datos.usuarioId,
    });
  });
}
