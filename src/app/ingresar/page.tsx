import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { sesionActual, primeraSeccionVisible } from "@/lib/sesion";
import { haySistemaInicializado } from "@/domain/usuarios/usuario.service";
import { FormularioIngreso } from "./_components/formulario-ingreso";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Entrar — Estación Verde",
};

export default async function PaginaIngreso(props: PageProps<"/ingresar">) {
  // La base sin usuarios manda a crear el primer administrador. La comprobación va
  // acá y no en `proxy.ts` a propósito: el proxy corre en cada request, incluidos
  // los que Next dispara por adelantado, y esto es una consulta a la base.
  if (!(await haySistemaInicializado())) redirect("/primer-arranque");

  const sesion = await sesionActual();

  if (sesion) {
    redirect(primeraSeccionVisible(sesion.usuario) ?? "/sin-permiso?permiso=ninguno");
  }

  const parametros = await props.searchParams;
  const volverCrudo = parametros.volver;
  const volver = typeof volverCrudo === "string" ? volverCrudo : "";

  return (
    <div className="brand-auth flex min-h-full w-full items-center justify-center px-5 py-12">
      <div className="mx-auto w-full max-w-sm space-y-5">
        <div className="flex justify-center">
          <Logo grande />
        </div>

        <Card className="border-white/80 bg-white/92 shadow-[0_24px_70px_rgba(78,61,30,0.12)] backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center">
            <p className="font-heading text-xl font-extrabold tracking-tight">Entrá al diario</p>
            <p className="text-sm text-muted-foreground">Caja, cheques y cuentas del negocio.</p>
          </CardHeader>
          <CardContent>
            <FormularioIngreso volver={volver} />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          ¿Olvidaste la contraseña? Te la puede restablecer cualquiera con permiso
          para configurar usuarios.
        </p>
      </div>
    </div>
  );
}
