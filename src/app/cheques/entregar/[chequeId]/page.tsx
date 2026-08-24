import Link from "next/link";
import { notFound } from "next/navigation";
import { chequeEnCarteraPorId, datosParaEntrega, proveedoresActivos } from "@/domain/cheques/consultas";
import { formatearPesos } from "@/lib/formato";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormularioEntrega } from "../../_components/formulario-entrega";
import { requerirPermiso } from "@/lib/sesion";

export const dynamic = "force-dynamic";

const FECHA_CORTA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

/**
 * El proveedor se elige por URL (`?proveedor=`) y no en el navegador. Así las
 * facturas pendientes las trae el servidor al navegar, sin buscar datos desde el
 * cliente ni duplicar consultas.
 */
export default async function PaginaEntregarCheque(
  props: PageProps<"/cheques/entregar/[chequeId]">,
) {
  await requerirPermiso("cheques.cargar");
  const { chequeId } = await props.params;
  const { proveedor: proveedorId } = await props.searchParams;

  const cheque = await chequeEnCarteraPorId(chequeId);
  if (!cheque) notFound();

  const proveedores = await proveedoresActivos();
  const seleccionado = typeof proveedorId === "string" ? proveedorId : null;
  const datos = seleccionado ? await datosParaEntrega(seleccionado) : null;

  return (
    <main className="app-page app-page-narrow space-y-8">
      <header className="space-y-1">
        <Link href="/cheques" className="text-sm text-muted-foreground hover:underline">
          ← Cartera
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Entregar cheque</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {cheque.banco} {cheque.numero}
          </CardTitle>
          <CardDescription>
            {cheque.librador} · vence {FECHA_CORTA.format(cheque.fechaVencimiento)} ·
            comprado a {cheque.vendedorCheque.nombre}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Dato etiqueta="Nominal" valor={formatearPesos(cheque.nominal)} destacado />
          <Dato etiqueta="Pagaste" valor={formatearPesos(cheque.montoPagado)} />
          <Dato etiqueta="Ahorro al entregar" valor={formatearPesos(cheque.ahorro)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿A qué proveedor?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="flex flex-wrap gap-2">
            {proveedores.map((proveedor) => (
              <li key={proveedor.id}>
                <Link
                  href={`/cheques/entregar/${chequeId}?proveedor=${proveedor.id}`}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent ${
                    proveedor.id === seleccionado ? "border-foreground bg-accent" : ""
                  }`}
                >
                  {proveedor.nombre}
                  {proveedor.saldo.isNegative() && (
                    <span className="text-xs text-muted-foreground">
                      {formatearPesos(proveedor.saldo.abs())} a favor
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {datos && (
            <div className="space-y-4 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {datos.facturas.length === 0
                  ? `${datos.proveedor.nombre} no tiene facturas pendientes.`
                  : `${datos.proveedor.nombre} debe ${formatearPesos(datos.deudaTotal)} en ${datos.facturas.length} factura${datos.facturas.length === 1 ? "" : "s"}.`}
              </p>

              <FormularioEntrega
                chequeId={cheque.id}
                proveedorId={datos.proveedor.id}
                nominal={cheque.nominal.toFixed(0)}
                facturas={datos.facturas.map((factura) => ({
                  id: factura.id,
                  numero: factura.numero,
                  saldoPendiente: factura.saldoPendiente.toFixed(0),
                  vencimiento: factura.fechaVencimiento
                    ? FECHA_CORTA.format(factura.fechaVencimiento)
                    : null,
                }))}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className={`tabular-nums ${destacado ? "text-lg font-semibold" : ""}`}>{valor}</p>
    </div>
  );
}
