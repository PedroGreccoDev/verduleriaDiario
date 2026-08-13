"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dec } from "@/lib/decimal";
import { ErrorDominio } from "@/lib/errores";
import { normalizarMontoTexto, normalizarPorcentajeTexto } from "@/lib/monto-texto";
import { comprarCheque } from "@/domain/cheques/compra.service";
import { entregarCheque } from "@/domain/cheques/entrega.service";
import { rechazarCheque } from "@/domain/cheques/rechazo.service";
import { revertirEntregaCheque } from "@/domain/cheques/reversion.service";
import type { ImputacionSolicitada } from "@/domain/proveedores/imputacion";

/**
 * Server Actions de cheques. Capa fina: parsean, llaman al dominio, traducen el
 * error. Ninguna validación de negocio vive acá.
 *
 * TODO(auth): alcanzables por POST directo. Cuando exista el login, verificación
 *   de sesión al principio de cada una.
 */

export interface ResultadoAccion {
  ok: boolean;
  mensaje?: string;
}

function montoObligatorio(valor: string, campo: string) {
  const canonico = normalizarMontoTexto(valor);
  if (canonico === null) {
    throw new ErrorDominio(
      "MONTO_INVALIDO",
      valor.includes(",")
        ? `${campo}: "${valor}" tiene centavos. Los montos van en pesos enteros.`
        : `${campo}: "${valor}" no es un monto válido.`,
    );
  }
  return dec(canonico);
}

async function ejecutar(
  accion: () => Promise<unknown>,
  /** Mensaje para cuando la base rechaza por índice único (P2002). */
  mensajeDuplicado?: string,
): Promise<ResultadoAccion> {
  try {
    await accion();
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return { ok: false, mensaje: error.message };
    }
    if (mensajeDuplicado && esViolacionDeUnicidad(error)) {
      return { ok: false, mensaje: mensajeDuplicado };
    }
    throw error;
  }

  revalidatePath("/cheques");
  // El historial vive en otra ruta y muestra las mismas entregas: revertir una
  // tiene que sacarla de ahí, no solo devolver el cheque a la cartera.
  revalidatePath("/cheques/entregas");
  return { ok: true };
}

/**
 * La unicidad de cheque (banco + número + librador) la impone la base, no el
 * dominio, así que llega como error de Prisma y no como ErrorDominio. Sin esta
 * traducción el operador vería una pantalla de error genérica en vez de "ya lo
 * cargaste".
 */
function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export async function accionComprarCheque(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const texto = (campo: string) => String(formulario.get(campo) ?? "").trim();

  const vendedorChequeId = texto("vendedorChequeId");
  const numero = texto("numero");
  const banco = texto("banco");
  const librador = texto("librador");
  const fechaVencimiento = texto("fechaVencimiento");

  if (!vendedorChequeId) return { ok: false, mensaje: "Elegí a quién le comprás el cheque." };
  if (!numero || !banco || !librador) {
    return { ok: false, mensaje: "Número, banco y librador son obligatorios." };
  }
  if (!fechaVencimiento) return { ok: false, mensaje: "Falta la fecha de vencimiento." };

  const porcentajeCanonico = normalizarPorcentajeTexto(texto("porcentajeDescuento"));
  if (porcentajeCanonico === null) {
    return { ok: false, mensaje: "El porcentaje de descuento no es válido." };
  }

  return ejecutar(
    () =>
      comprarCheque({
        vendedorChequeId,
        numero,
        banco,
        librador,
        nominal: montoObligatorio(texto("nominal"), "Nominal"),
        porcentajeDescuento: dec(porcentajeCanonico),
        // <input type="date"> entrega "2026-11-15"; el sufijo lo fija a mediodía
        // UTC para que ningún corrimiento de zona lo pase al día anterior.
        fechaVencimiento: new Date(`${fechaVencimiento}T12:00:00Z`),
        observacion: texto("observacion") || null,
      }),
    `Ya cargaste el cheque ${numero} del banco ${banco} librado por ${librador}.`,
  );
}

export async function accionEntregarCheque(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const chequeId = String(formulario.get("chequeId") ?? "");
  const proveedorId = String(formulario.get("proveedorId") ?? "");

  if (!proveedorId) return { ok: false, mensaje: "Elegí a qué proveedor se lo entregás." };

  // Los montos vienen como imputacion:<facturaId>. Las que quedaron vacías o en
  // cero se descartan: imputar cero no significa nada.
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

  const resultado = await ejecutar(() =>
    entregarCheque({ chequeId, proveedorId, imputaciones }),
  );

  if (resultado.ok) redirect("/cheques");
  return resultado;
}

export async function accionRechazarCheque(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const chequeId = String(formulario.get("chequeId") ?? "");
  const motivo = String(formulario.get("motivo") ?? "").trim();

  if (!motivo) return { ok: false, mensaje: "Escribí el motivo del rechazo." };

  return ejecutar(() => rechazarCheque({ chequeId, motivo }));
}

/**
 * Deshace una entrega: el cheque vuelve a la cartera y las facturas que había
 * saldado vuelven a deberse.
 */
export async function accionRevertirEntrega(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const chequeId = String(formulario.get("chequeId") ?? "");

  return ejecutar(() => revertirEntregaCheque({ chequeId }));
}
