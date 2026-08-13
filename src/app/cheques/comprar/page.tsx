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

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comprar cheque — Estación Verde",
};

export default async function PaginaComprarCheque() {
  const vendedores = await vendedoresActivos();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <Link href="/cheques" className="text-sm text-muted-foreground hover:underline">
          ← Cartera
        </Link>
        <h1 className="text-2xl font-semibold">Comprar cheque</h1>
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
