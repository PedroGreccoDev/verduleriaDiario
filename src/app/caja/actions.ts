"use server";

import { revalidatePath } from "next/cache";
import { ErrorDominio } from "@/lib/errores";
import { montoDeFormulario } from "@/lib/formulario-monto";
import { abrirTurno, cerrarTurno } from "@/domain/caja/turno.service";
import { registrarRetiroParcial } from "@/domain/caja/retiro.service";

/**
 * Server Actions de la pantalla de caja.
 *
 * Son una capa fina: parsean el formulario, llaman al dominio y traducen el
 * resultado a algo que la UI pueda mostrar. Toda la lógica y todas las
 * validaciones viven en `src/domain` — acá no se decide nada.
 *
 * TODO(auth): estas funciones son alcanzables por POST directo, no solo desde la
 *   pantalla. Cuando exista el login, va una verificación de sesión al principio
 *   de cada una.
 */

export interface ResultadoAccion {
  ok: boolean;
  mensaje?: string;
}

const EXITO: ResultadoAccion = { ok: true };

/** Traduce los errores de dominio a un mensaje; deja pasar el resto. */
async function ejecutar(accion: () => Promise<unknown>): Promise<ResultadoAccion> {
  try {
    await accion();
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return { ok: false, mensaje: error.message };
    }
    throw error;
  }

  revalidatePath("/caja");
  return EXITO;
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

  return ejecutar(() =>
    abrirTurno({ nombre, observacion: observacion || null }),
  );
}

export async function accionRegistrarRetiro(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const turnoId = String(formulario.get("turnoId") ?? "");
  const observacion = String(formulario.get("observacion") ?? "").trim();

  return ejecutar(() =>
    registrarRetiroParcial({
      turnoId,
      monto: montoDeFormulario(String(formulario.get("monto") ?? "")),
      observacion: observacion || "Retiro parcial",
    }),
  );
}

export async function accionCerrarTurno(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const turnoId = String(formulario.get("turnoId") ?? "");
  const montoTexto = String(formulario.get("monto") ?? "").trim();

  return ejecutar(() =>
    cerrarTurno({
      turnoId,
      // Vacío significa cerrar sin retiro: puede haberse retirado todo antes.
      montoRetiro: montoTexto ? montoDeFormulario(montoTexto) : null,
    }),
  );
}
