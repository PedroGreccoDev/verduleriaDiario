"use server";

import { revalidatePath } from "next/cache";
import { dec } from "@/lib/decimal";
import { ErrorDominio } from "@/lib/errores";
import { exigirPermiso } from "@/lib/sesion";
import { montoDeFormulario } from "@/lib/formulario-monto";
import { normalizarMontoTexto } from "@/lib/monto-texto";
import { crearFacturaProveedor } from "@/domain/proveedores/factura.service";
import { pagarProveedorEnEfectivo } from "@/domain/proveedores/pago.service";
import type { ImputacionSolicitada } from "@/domain/proveedores/imputacion";

/**
 * Server Actions de proveedores. Capa fina: parsean, llaman al dominio, traducen
 * el error. Ninguna validación de negocio vive acá.
 *
 * Cada una empieza por `exigirPermiso`, que además devuelve quién está
 * trabajando para registrarlo como autor (§9). Va acá y no solo en la pantalla
 * porque una Server Action es un endpoint POST: se alcanza sin pasar por ninguna
 * pantalla.
 */

export interface ResultadoAccion {
  ok: boolean;
  mensaje?: string;
}

async function ejecutar(
  proveedorId: string,
  permiso: string,
  accion: (usuarioId: string) => Promise<unknown>,
  /** Mensaje para cuando la base rechaza por índice único (P2002). */
  mensajeDuplicado?: string,
): Promise<ResultadoAccion> {
  try {
    const usuario = await exigirPermiso(permiso);
    await accion(usuario.id);
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return { ok: false, mensaje: error.message };
    }
    if (mensajeDuplicado && esViolacionDeUnicidad(error)) {
      return { ok: false, mensaje: mensajeDuplicado };
    }
    throw error;
  }

  revalidatePath(`/proveedores/${proveedorId}`);
  // El listado muestra el saldo y el conteo de facturas pendientes de cada uno:
  // cargar una factura o pagar cambia las dos cosas.
  revalidatePath("/proveedores");
  return { ok: true };
}

/**
 * El número de factura es único por proveedor y lo impone la base, así que llega
 * como error de Prisma y no como ErrorDominio. Sin esta traducción el operador
 * vería una pantalla de error genérica en vez de "ya la cargaste".
 */
function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

/**
 * Alta de factura (§3.3).
 *
 * La fecha de vencimiento es opcional: hay proveedores que entregan sin plazo y
 * exigir una fecha inventada llenaría el reporte de vencimientos con datos falsos.
 */
export async function accionCrearFactura(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const texto = (campo: string) => String(formulario.get(campo) ?? "").trim();

  const proveedorId = texto("proveedorId");
  const numero = texto("numero");
  const fecha = texto("fecha");
  const fechaVencimiento = texto("fechaVencimiento");

  if (!numero) return { ok: false, mensaje: "Falta el número de la factura." };

  return ejecutar(
    proveedorId,
    "proveedores.cargar",
    () =>
      crearFacturaProveedor({
        proveedorId,
        numero,
        montoTotal: montoDeFormulario(texto("montoTotal"), "Monto"),
        // <input type="date"> entrega "2026-11-15"; el sufijo lo fija a mediodía
        // UTC para que ningún corrimiento de zona lo pase al día anterior.
        fecha: fecha ? new Date(`${fecha}T12:00:00Z`) : undefined,
        fechaVencimiento: fechaVencimiento
          ? new Date(`${fechaVencimiento}T12:00:00Z`)
          : null,
      }),
    `${numero} ya está cargada para este proveedor.`,
  );
}

/**
 * Pago en efectivo con imputación a facturas (§4.5).
 *
 * Mismo formato de imputaciones que la entrega de cheque —`imputacion:<facturaId>`—
 * porque es el mismo flujo; lo que cambia es que acá sale plata de la Bolsa Grande.
 */
export async function accionPagarEnEfectivo(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const proveedorId = String(formulario.get("proveedorId") ?? "");
  const observacion = String(formulario.get("observacion") ?? "").trim();

  // Las imputaciones vacías o en cero se descartan: imputar cero no significa nada.
  const imputaciones: ImputacionSolicitada[] = [];
  for (const [clave, valor] of formulario.entries()) {
    if (!clave.startsWith("imputacion:")) continue;

    const texto = String(valor).trim();
    if (texto === "") continue;

    const canonico = normalizarMontoTexto(texto);
    if (canonico === null) {
      return {
        ok: false,
        mensaje: texto.includes(",")
          ? `"${texto}" tiene centavos. Los montos van en pesos enteros.`
          : `"${texto}" no es un monto válido.`,
      };
    }

    const monto = dec(canonico);
    if (monto.isZero()) continue;

    imputaciones.push({
      facturaProveedorId: clave.slice("imputacion:".length),
      monto,
    });
  }

  return ejecutar(proveedorId, "proveedores.cargar", (usuarioId) =>
    pagarProveedorEnEfectivo({
      proveedorId,
      monto: montoDeFormulario(String(formulario.get("monto") ?? ""), "Monto del pago"),
      imputaciones,
      observacion: observacion || null,
      usuarioId,
    }),
  );
}
