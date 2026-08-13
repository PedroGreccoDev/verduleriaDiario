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
  const resumen = await resumenCartera();
  const hoy = new Date();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cartera de cheques</h1>
          <p className="text-sm text-muted-foreground">
            Se mide a valor nominal. No se suma con la plata de la caja: son dos
            cosas distintas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/cheques/entregas">Entregas</Link>
          </Button>
          <Button asChild>
            <Link href="/cheques/comprar">Comprar cheque</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>En cartera, a nominal</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatearPesos(resumen.nominalTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {resumen.cheques.length} cheque{resumen.cheques.length === 1 ? "" : "s"} sin
              entregar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lo que pagaste por ellos</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatearPesos(resumen.costoTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Ahorro latente {formatearPesos(resumen.ahorroLatente)}: todavía no es
              tuyo, el cheque puede rebotar.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ahorro de este mes</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatearPesos(resumen.ahorroDelMes)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              De {resumen.chequesEntregadosEnElMes} cheque
              {resumen.chequesEntregadosEnElMes === 1 ? "" : "s"} entregado
              {resumen.chequesEntregadosEnElMes === 1 ? "" : "s"}. No es un ingreso de
              caja.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cheques en cartera</CardTitle>
          <CardDescription>Ordenados por vencimiento, el más próximo primero.</CardDescription>
        </CardHeader>
        <CardContent>
          {resumen.cheques.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay cheques en cartera.
            </p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </main>
  );
}
