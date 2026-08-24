"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErrorDominio } from "@/lib/errores";
import { exigirPermiso } from "@/lib/sesion";
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
 * Cada una empieza por `exigirPermiso`, que además devuelve quién está
 * trabajando para registrarlo como autor del movimiento (§9). Va acá y no solo en
 * la pantalla porque una Server Action es un endpoint POST: se alcanza sin pasar
 * por ninguna pantalla.
 */

export interface ResultadoAccion {
  ok: boolean;
  mensaje?: string;
}

async function ejecutar(
  clienteId: string,
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
    await exigirPermiso("clientes.cargar");
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

  return ejecutar(clienteId, "clientes.cargar", (usuarioId) =>
    registrarCargoCliente({
      clienteId,
      monto: montoDeFormulario(String(formulario.get("monto") ?? ""), "Monto"),
      observacion: observacion || null,
      usuarioId,
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

  return ejecutar(clienteId, "clientes.cargar", (usuarioId) =>
    registrarPagoCliente({
      clienteId,
      monto: montoDeFormulario(String(formulario.get("monto") ?? ""), "Monto"),
      observacion: observacion || null,
      usuarioId,
    }),
  );
}
