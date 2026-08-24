import { requerirUsuario } from "@/lib/sesion";
import {
  ETIQUETA_ROL,
  etiquetaPermiso,
  PERMISOS,
} from "@/domain/usuarios/permisos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormularioMiContrasena } from "./_components/formulario-mi-contrasena";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi cuenta — Estación Verde",
};

export default async function PaginaMiCuenta(props: PageProps<"/mi-cuenta">) {
  const usuario = await requerirUsuario();
  const parametros = await props.searchParams;
  const vieneObligado = parametros.cambiar === "1" && usuario.debeCambiarContrasena;

  return (
    <main className="app-page app-page-narrow space-y-8">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">
          {usuario.nombre} · entra como{" "}
          <span className="font-medium">{usuario.usuario}</span> ·{" "}
          {ETIQUETA_ROL[usuario.rol]}
        </p>
      </header>

      {vieneObligado && (
        <Alert role="alert">
          <AlertDescription>
            Estás usando una contraseña que te puso un administrador. Elegí una
            propia: mientras no lo hagas, la persona que te la dio puede entrar como
            vos.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cambiar la contraseña</CardTitle>
          <CardDescription>
            Pide la actual a propósito. Como las sesiones no se cierran solas,
            cualquiera que pase por una máquina con tu sesión abierta podría
            quedarse con la cuenta si no la pidiera.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioMiContrasena />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Qué podés hacer</CardTitle>
          <CardDescription>
            Para cambiarlo hace falta alguien con permiso para configurar usuarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usuario.permisos.length === PERMISOS.length ? (
            <p className="text-sm text-muted-foreground">
              Todo: no hay ningún permiso que no tengas.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {usuario.permisos.map((permiso) => (
                <li key={permiso}>
                  <Badge variant="secondary">{etiquetaPermiso(permiso)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
