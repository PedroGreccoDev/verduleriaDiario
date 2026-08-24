import Link from "next/link";
import { vendedoresActivos } from "@/domain/cheques/consultas";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormularioCompra } from "../_components/formulario-compra";
import { requerirPermiso } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comprar cheque — Estación Verde",
};

export default async function PaginaComprarCheque() {
  await requerirPermiso("cheques.cargar");

  const vendedores = await vendedoresActivos();

  return (
    <main className="app-page app-page-narrow space-y-8">
      <header className="space-y-1">
        <Link href="/cheques" className="text-sm text-muted-foreground hover:underline">
          ← Cartera
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Comprar cheque</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del cheque</CardTitle>
          <CardDescription>
            Cargá el nominal y el descuento; el sistema calcula cuánto pagás y te lo
            muestra antes de confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vendedores.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay vendedores de cheques cargados. Hace falta al menos uno para
              registrar una compra.
            </p>
          ) : (
            <FormularioCompra
              vendedores={vendedores.map((v) => ({ id: v.id, nombre: v.nombre }))}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
