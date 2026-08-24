import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { primeraSeccionVisible, requerirUsuario } from "@/lib/sesion";
import { etiquetaPermiso } from "@/domain/usuarios/permisos";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sin permiso — Estación Verde",
};

export default async function PaginaSinPermiso(props: PageProps<"/sin-permiso">) {
  const usuario = await requerirUsuario();
  const parametros = await props.searchParams;
  const permiso = typeof parametros.permiso === "string" ? parametros.permiso : "";

  const destino = primeraSeccionVisible(usuario);

  return (
    <main className="app-page app-page-narrow">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Esto no lo podés hacer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {permiso && permiso !== "ninguno" ? (
              <>
                Tu usuario ({usuario.nombre}) no tiene el permiso{" "}
                <span className="font-medium text-foreground">
                  {etiquetaPermiso(permiso)}
                </span>
                .
              </>
            ) : (
              <>
                Tu usuario ({usuario.nombre}) no tiene acceso a ninguna sección
                todavía.
              </>
            )}{" "}
            Pedíselo a alguien que pueda configurar usuarios.
          </p>

          {destino ? (
            <Button asChild variant="outline">
              <Link href={destino}>Volver</Link>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Mientras tanto no hay ninguna pantalla a la que mandarte: la cuenta
              está creada pero sin ningún permiso marcado.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
