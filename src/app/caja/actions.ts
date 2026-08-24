"use server";

import { revalidatePath } from "next/cache";
import { ErrorDominio } from "@/lib/errores";
import { exigirPermiso } from "@/lib/sesion";
import { montoDeFormulario } from "@/lib/formulario-monto";
import { abrirTurno, cerrarTurno } from "@/domain/caja/turno.service";
import { registrarRetiroParcial } from "@/domain/caja/retiro.service";
import { registrarMovimientoManual } from "@/domain/caja/movimiento-manual.service";

/**
 * Server Actions de la pantalla de caja.
 *
 * Son una capa fina: parsean el formulario, llaman al dominio y traducen el
 * resultado a algo que la UI pueda mostrar. Toda la lógica y todas las
 * validaciones viven en `src/domain` — acá no se decide nada.
 *
 * Lo único que sí se decide acá es el permiso y el autor: cada acción empieza por
 * `exigirPermiso`, que devuelve quién está trabajando, y ese id viaja al dominio
 * como `usuarioId` (§9). La verificación va en cada acción y no solo en la
 * pantalla porque una Server Action es un endpoint POST: se alcanza sin pasar por
 * ninguna pantalla, y esconder el botón no protege nada.
 */

export interface ResultadoAccion {
  ok: boolean;
  mensaje?: string;
}

const EXITO: ResultadoAccion = { ok: true };

/**
 * Exige el permiso, corre la acción con el usuario que la ejecuta y traduce los
 * errores de dominio a un mensaje. Deja pasar el resto.
 */
async function ejecutar(
  permiso: string,
  accion: (usuarioId: string) => Promise<unknown>,
): Promise<ResultadoAccion> {
  try {
    const usuario = await exigirPermiso(permiso);
    await accion(usuario.id);
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return { ok: false, mensaje: error.message };
    }
    throw error;
  }

  revalidatePath("/caja");
  return EXITO;
}

/**
 * Gasto o ingreso cargado a mano. No lleva turno: el dominio lo asocia al turno
 * abierto si hay alguno, y si no lo deja fuera de turno (§3.1).
 */
export async function accionRegistrarMovimiento(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const categoriaId = String(formulario.get("categoriaId") ?? "");
  const observacion = String(formulario.get("observacion") ?? "").trim();

  if (!categoriaId) return { ok: false, mensaje: "Elegí una categoría." };

  return ejecutar("caja.cargar", (usuarioId) =>
    registrarMovimientoManual({
      categoriaId,
      monto: montoDeFormulario(String(formulario.get("monto") ?? ""), "Monto"),
      observacion: observacion || null,
      usuarioId,
    }),
  );
}

export async function accionAbrirTurno(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const observacion = String(formulario.get("observacion") ?? "").trim();

  if (!nombre) {
    return { ok: false, mensaje: "Elegí qué turno estás abriendo." };
  }

  return ejecutar("turno.gestionar", (usuarioId) =>
    abrirTurno({ nombre, observacion: observacion || null, usuarioId }),
  );
}

export async function accionRegistrarRetiro(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const turnoId = String(formulario.get("turnoId") ?? "");
  const observacion = String(formulario.get("observacion") ?? "").trim();

  return ejecutar("caja.cargar", (usuarioId) =>
    registrarRetiroParcial({
      turnoId,
      monto: montoDeFormulario(String(formulario.get("monto") ?? "")),
      observacion: observacion || "Retiro parcial",
      usuarioId,
    }),
  );
}

export async function accionCerrarTurno(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const turnoId = String(formulario.get("turnoId") ?? "");
  const montoTexto = String(formulario.get("monto") ?? "").trim();

  return ejecutar("turno.gestionar", (usuarioId) =>
    cerrarTurno({
      turnoId,
      // Vacío significa cerrar sin retiro: puede haberse retirado todo antes.
      montoRetiro: montoTexto ? montoDeFormulario(montoTexto) : null,
      usuarioId,
    }),
  );
}
