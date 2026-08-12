import { prisma, type PrismaTx } from "@/lib/prisma";
import type { Decimal } from "@/lib/decimal";
import { registrarMovimientoCaja } from "./movimiento.service";

export interface DatosRetiro {
  turnoId: string;
  monto: Decimal;
  fecha?: Date;
  observacion?: string | null;
}

/**
 * Retiro de la registradora hacia la Bolsa Grande (§2.2, §4.1).
 *
 * Es un INGRESO, no una transferencia: el sistema no modela la caja registradora,
 * así que el dinero "aparece" al depositarse. §2.2 anticipa que el día que se
 * modele la registradora esto pasa a ser una transferencia entre dos cajas, y el
 * modelo lo soporta sin rehacerse.
 *
 * Puede haber varios retiros por turno: retiros parciales por seguridad, sin
 * cerrar el turno (§4.1, paso 4). No hay tope ni validación de "cuánto había",
 * porque el sistema no sabe cuánto se vendió.
 *
 * Recibe `tx` para poder componerse con el cierre de turno, que hace las dos
 * cosas en una sola transacción.
 */
export async function registrarRetiro(tx: PrismaTx, datos: DatosRetiro) {
  return registrarMovimientoCaja(tx, {
    categoriaSlug: "retiro_turno",
    monto: datos.monto,
    referenciaTipo: "retiro_turno",
    referenciaId: datos.turnoId,
    turnoId: datos.turnoId,
    fecha: datos.fecha,
    observacion: datos.observacion ?? null,
  });
}

/** Igual que `registrarRetiro`, pero abriendo su propia transacción. */
export async function registrarRetiroParcial(datos: DatosRetiro) {
  return prisma.$transaction((tx) => registrarRetiro(tx, datos));
}
