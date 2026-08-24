import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { haySistemaInicializado } from "@/domain/usuarios/usuario.service";
import { FormularioPrimerAdministrador } from "./_components/formulario-primer-administrador";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Primer arranque — Estación Verde",
};

/**
 * Se ve una sola vez en la vida de la instalación: cuando no hay ningún usuario.
 *
 * En cuanto existe uno, esta pantalla redirige a la de ingreso y la acción que
 * hay detrás deja de crear nada. No queda ninguna cuenta de fábrica ni ninguna
 * contraseña escrita en el repositorio: la primera la elige quien instala.
 */
export default async function PaginaPrimerArranque() {
  if (await haySistemaInicializado()) redirect("/ingresar");

  return (
    <div className="flex min-h-full w-full items-center justify-center px-5 py-12">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="font-heading text-xl font-semibold">
            No hay usuarios todavía
          </h1>
          <p className="text-sm text-muted-foreground">
            Creá la primera cuenta. Va a poder hacer todo, incluido dar de alta a
            las demás personas y decidir qué puede hacer cada una.
          </p>
        </div>

        <FormularioPrimerAdministrador />
      </div>
    </div>
  );
}
