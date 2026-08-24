import Link from "next/link";
import { historialEntregas } from "@/domain/cheques/consultas";
import { formatearPesos } from "@/lib/formato";
import { BotonRevertirEntrega } from "../_components/boton-revertir-entrega";
import { BotonRechazarCheque } from "../_components/boton-rechazar-cheque";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requerirPermiso } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Entregas — Estación Verde",
};

const FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * Historial de entregas, con la posibilidad de deshacer una que se cargó mal (§4.3).
 *
 * Se muestran las facturas que cada cheque saldó porque son exactamente lo que
 * vuelve a deberse al revertir: sin ese detalle, el operador estaría deshaciendo
 * a ciegas.
 */
export default async function PaginaEntregas() {
  await requerirPermiso("cheques.ver");

  const entregas = await historialEntregas();

  return (
    <main className="app-page space-y-8">
      <header>
        <Link href="/cheques" className="text-sm text-muted-foreground hover:underline">
          ← Cartera
        </Link>
        <h1 className="font-heading mt-1 text-2xl font-semibold">Entregas de cheques</h1>
        <p className="text-sm text-muted-foreground">
          Las más recientes primero. Revertir una entrega es para corregirla cuando
          se cargó mal: devuelve el cheque a la cartera y reabre las facturas que
          había saldado. Un cheque que rebotó no se revierte —lo levanta quien te lo
          vendió— y se registra como rechazado.
        </p>
      </header>

      {entregas.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              Todavía no entregaste ningún cheque.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {entregas.map((entrega) => (
            <li key={entrega.chequeId}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {entrega.banco} {entrega.numero}
                      </CardTitle>
                      <CardDescription>
                        {FECHA.format(entrega.fechaEntrega)} · a {entrega.proveedor} ·{" "}
                        librado por {entrega.librador}
                      </CardDescription>
                    </div>
                    <span className="text-lg font-semibold tabular-nums">
                      {formatearPesos(entrega.nominal)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {entrega.facturas.length > 0 && (
                    <ul className="space-y-1 text-sm">
                      {entrega.facturas.map((factura) => (
                        <li
                          key={factura.numero}
                          className="flex justify-between gap-4 text-muted-foreground"
                        >
                          <span>Factura {factura.numero}</span>
                          <span className="tabular-nums">
                            {formatearPesos(factura.montoImputado)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {entrega.aCuenta.greaterThan(0) && (
                    <p className="text-sm text-muted-foreground">
                      {formatearPesos(entrega.aCuenta)} quedaron como saldo a favor del
                      proveedor.
                    </p>
                  )}

                  {entrega.rechazo ? (
                    <div className="space-y-1 border-t pt-3 text-sm text-muted-foreground">
                      <p>
                        Rebotó
                        {entrega.rechazo.fecha &&
                          ` el ${FECHA.format(entrega.rechazo.fecha)}`}
                        {/* El motivo lo escribió el operador y suele traer su propio
                            punto final, así que va aislado y no dentro de una frase. */}
                        {entrega.rechazo.motivo && ` — ${entrega.rechazo.motivo}`}
                      </p>
                      <p>
                        Lo levanta{" "}
                        <span className="font-medium text-foreground">
                          quien te lo vendió
                        </span>
                        ; la deuda con el proveedor sigue saldada.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-end gap-2 border-t pt-3">
                      <BotonRechazarCheque chequeId={entrega.chequeId} />
                      <BotonRevertirEntrega
                        chequeId={entrega.chequeId}
                        descripcion={describirLoQueVuelve(entrega)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** Una línea que diga exactamente qué se reabre, para ponerla en la confirmación. */
function describirLoQueVuelve(entrega: Awaited<ReturnType<typeof historialEntregas>>[number]) {
  const partes = entrega.facturas.map(
    (f) => `${formatearPesos(f.montoImputado)} a la factura ${f.numero}`,
  );

  if (entrega.aCuenta.greaterThan(0)) {
    partes.push(`${formatearPesos(entrega.aCuenta)} de saldo a favor`);
  }

  return partes.length > 0
    ? partes.join(", ")
    : `${formatearPesos(entrega.nominal)} al proveedor`;
}
