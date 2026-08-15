import { prisma } from "@/lib/prisma";
import { errorDominio } from "@/lib/errores";

export interface DatosNuevoCliente {
  nombre: string;
  telefono?: string | null;
}

/**
 * Alta de cliente de cuenta corriente (§3.4).
 *
 * Dos campos y nada más. Sin POS, el alta la hace el operador con el cliente
 * esperando en el mostrador (§2.4): cada campo de más es una chance de que
 * terminen anotando el fiado en un papel.
 *
 * NO se rechazan los nombres repetidos. En un barrio hay dos Rosas, y la base no
 * tiene restricción de unicidad sobre el nombre: un chequeo acá sería una ilusión
 * —dos altas simultáneas lo esquivan— y a cambio bloquearía un alta legítima. El
 * teléfono es lo que los distingue en la pantalla.
 */
export async function registrarCliente(datos: DatosNuevoCliente) {
  const nombre = datos.nombre.trim();

  if (nombre === "") {
    throw errorDominio("NOMBRE_REQUERIDO", "El cliente necesita un nombre.");
  }

  return prisma.cliente.create({
    data: {
      nombre,
      telefono: datos.telefono?.trim() || null,
    },
  });
}
