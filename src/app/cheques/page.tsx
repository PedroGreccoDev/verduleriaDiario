import Link from "next/link";
import { resumenCartera } from "@/domain/cheques/consultas";
import { formatearPesos } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TarjetaTotal } from "@/components/tarjeta-total";
import { requerirPermiso } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cheques — Estación Verde",
};

const FECHA_CORTA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

export default async function PaginaCheques() {
  await requerirPermiso("cheques.ver");

  const resumen = await resumenCartera();
  const hoy = new Date();

  return (
    <main className="app-page space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Cartera de cheques</h1>
          <p className="text-sm text-muted-foreground">
            Se mide a valor nominal. No se suma con la plata de la caja: son dos
            cosas distintas.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button asChild variant="outline">
            <Link href="/cheques/entregas">Entregas</Link>
          </Button>
          <Button asChild>
            <Link href="/cheques/comprar">Comprar cheque</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <TarjetaTotal
          etiqueta="En cartera, a nominal"
          monto={formatearPesos(resumen.nominalTotal)}
          detalle={`${resumen.cheques.length} cheque${resumen.cheques.length === 1 ? "" : "s"} sin entregar`}
        />
        <TarjetaTotal
          etiqueta="Lo que pagaste por ellos"
          monto={formatearPesos(resumen.costoTotal)}
          detalle={`Ahorro latente ${formatearPesos(resumen.ahorroLatente)}`}
        />
        <TarjetaTotal
          etiqueta="Ahorro de este mes"
          monto={formatearPesos(resumen.ahorroDelMes)}
          detalle={`De ${resumen.chequesEntregadosEnElMes} cheque${resumen.chequesEntregadosEnElMes === 1 ? "" : "s"} entregado${resumen.chequesEntregadosEnElMes === 1 ? "" : "s"}`}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        El ahorro latente todavía no es tuyo: el cheque puede rebotar. El ahorro ya
        realizado tampoco es un ingreso de caja —es un menor egreso.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cheques en cartera</CardTitle>
          <CardDescription>Ordenados por vencimiento, el más próximo primero.</CardDescription>
        </CardHeader>
        <CardContent>
          {resumen.cheques.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                No hay cheques en cartera.
              </p>
              <Button asChild>
                <Link href="/cheques/comprar">Comprar primer cheque</Link>
              </Button>
            </div>
          ) : (
            <>
              <ul className="space-y-3 sm:hidden">
                {resumen.cheques.map((cheque) => {
                  const diasParaVencer = Math.round(
                    (cheque.fechaVencimiento.getTime() - hoy.getTime()) / 86_400_000,
                  );

                  return (
                    <li
                      key={cheque.id}
                      className="rounded-xl border border-border bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">
                            {cheque.banco} {cheque.numero}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {cheque.librador} · de {cheque.vendedorCheque.nombre}
                          </p>
                        </div>
                        <p className="font-heading text-lg font-bold tabular-nums">
                          {formatearPesos(cheque.nominal)}
                        </p>
                      </div>

                      <dl className="mt-3 grid grid-cols-2 gap-3 border-y border-border/70 py-3 text-xs">
                        <div>
                          <dt className="text-muted-foreground">Pagado</dt>
                          <dd className="mt-0.5 font-medium tabular-nums">
                            {formatearPesos(cheque.montoPagado)}
                          </dd>
                        </div>
                        <div className="text-right">
                          <dt className="text-muted-foreground">Vence</dt>
                          <dd className="mt-0.5 font-medium">
                            {FECHA_CORTA.format(cheque.fechaVencimiento)}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          {diasParaVencer <= 7 && (
                            <Badge variant="destructive">
                              {diasParaVencer < 0 ? "Vencido" : `${diasParaVencer} d`}
                            </Badge>
                          )}
                        </div>
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/cheques/entregar/${cheque.id}`}>Entregar</Link>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden sm:block">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cheque</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumen.cheques.map((cheque) => {
                  const diasParaVencer = Math.round(
                    (cheque.fechaVencimiento.getTime() - hoy.getTime()) / 86_400_000,
                  );

                  return (
                    <TableRow key={cheque.id}>
                      <TableCell>
                        <span className="font-medium">
                          {cheque.banco} {cheque.numero}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {cheque.librador} · de {cheque.vendedorCheque.nombre}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {FECHA_CORTA.format(cheque.fechaVencimiento)}
                        {diasParaVencer <= 7 && (
                          <Badge variant="destructive" className="ml-2">
                            {diasParaVencer < 0
                              ? "vencido"
                              : `${diasParaVencer} d`}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatearPesos(cheque.nominal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatearPesos(cheque.montoPagado)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/cheques/entregar/${cheque.id}`}>Entregar</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
