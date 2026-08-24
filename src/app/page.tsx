import { redirect } from "next/navigation";
import { primeraSeccionVisible, requerirUsuario } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/**
 * La raíz no tiene pantalla propia: manda a la primera sección que la persona
 * pueda ver.
 *
 * Antes iba siempre a `/caja`, que era correcto cuando había un solo usuario.
 * Ahora un empleado sin `caja.ver` aterrizaría en un cartel de "no podés" apenas
 * entra, así que el destino depende de quién es (§9).
 */
export default async function Home() {
  const usuario = await requerirUsuario();

  redirect(primeraSeccionVisible(usuario) ?? "/sin-permiso?permiso=ninguno");
}
