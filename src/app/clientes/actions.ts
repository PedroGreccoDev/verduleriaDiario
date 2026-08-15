"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErrorDominio } from "@/lib/errores";
import { montoDeFormulario } from "@/lib/formulario-monto";
import { registrarCliente } from "@/domain/clientes/cliente.service";
import {
  registrarCargoCliente,
  registrarPagoCliente,
} from "@/domain/clientes/cuenta-corriente.service";

/**
 * Server Actions de clientes. Capa fina: parsean, llaman al dominio, traducen el
 * error. Ninguna validación de negocio vive acá.
 *
 * TODO(auth): alcanzables por POST directo. Cuando exista el login, verificación
 *   de sesión al principio de cada una.
 */

export interface ResultadoAccion {
  ok: boolean;
  mensaje?: string;
}

async function ejecutar(
  clienteId: string,
  accion: () => Promise<unknown>,
): Promise<ResultadoAccion> {
  try {
    await accion();
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return { ok: false, mensaje: error.message };
    }
    throw error;
  }

  revalidatePath(`/clientes/${clienteId}`);
  // El listado muestra el saldo y desde cuándo debe cada uno: fiar o cobrar cambia
  // las dos cosas.
  revalidatePath("/clientes");
  return { ok: true };
}

/**
 * Alta de cliente. Redirige a su cuenta porque el alta casi nunca es el objetivo:
 * se da de alta a alguien PARA fiarle, y el formulario de fiado está ahí.
 */
export async function accionRegistrarCliente(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const nombre = String(formulario.get("nombre") ?? "").trim();
  const telefono = String(formulario.get("telefono") ?? "").trim();

  let clienteId: string;

  try {
    const cliente = await registrarCliente({ nombre, telefono: telefono || null });
    clienteId = cliente.id;
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return { ok: false, mensaje: error.message };
    }
    throw error;
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${clienteId}`);
}

/** Fiar: el cliente se lleva mercadería y queda debiendo. No mueve la caja. */
export async function accionFiar(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const clienteId = String(formulario.get("clienteId") ?? "");
  const observacion = String(formulario.get("observacion") ?? "").trim();

  return ejecutar(clienteId, () =>
    registrarCargoCliente({
      clienteId,
      monto: montoDeFormulario(String(formulario.get("monto") ?? ""), "Monto"),
      observacion: observacion || null,
    }),
  );
}

/** Cobrar el fiado: entra efectivo a la Bolsa Grande. */
export async function accionCobrar(
  _previo: ResultadoAccion,
  formulario: FormData,
): Promise<ResultadoAccion> {
  const clienteId = String(formulario.get("clienteId") ?? "");
  const observacion = String(formulario.get("observacion") ?? "").trim();

  return ejecutar(clienteId, () =>
    registrarPagoCliente({
      clienteId,
      monto: montoDeFormulario(String(formulario.get("monto") ?? ""), "Monto"),
      observacion: observacion || null,
    }),
  );
}
