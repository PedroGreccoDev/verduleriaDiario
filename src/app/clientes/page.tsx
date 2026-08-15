import Link from "next/link";
import { clientesConSaldo } from "@/domain/clientes/consultas";
import { CERO, esPositivo } from "@/lib/decimal";
import { formatearPesos } from "@/lib/formato";
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
import { FormularioCliente } from "./_components/formulario-cliente";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clientes — Estación Verde",
};

const FECHA_CORTA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** A partir de acá la deuda ya no es "la compra de esta semana". */
const DIAS_VIEJA = 30;

export default async function PaginaClientes() {
  const clientes = await clientesConSaldo();
  const hoy = new Date();

  // Deuda y saldo a favor van separados, igual que con proveedores (§3.3): que un
  // cliente haya pagado de más no cancela lo que otro debe.
  // `esPositivo` y no `isPositive()`: para decimal.js el cero es positivo, y un
  // cliente al día no es un deudor.
  const deudores = clientes.filter((c) => esPositivo(c.saldo));
  const seDebe = deudores.reduce((total, c) => total.plus(c.saldo), CERO);
  const aFavor = clientes
    .filter((c) => c.saldo.isNegative())
    .reduce((total, c) => total.plus(c.saldo.abs()), CERO);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            La cuenta corriente del fiado: quién debe, cuánto y desde cuándo.
          </p>
        </div>
        <FormularioCliente />
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fiado sin cobrar</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatearPesos(seDebe)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Repartido entre {deudores.length} cliente{deudores.length === 1 ? "" : "s"}.
              Es mercadería que salió y todavía no volvió como plata.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Saldo a favor de clientes</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatearPesos(aFavor)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Pagaron de más. Se descuenta solo de lo próximo que se lleven.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cuentas</CardTitle>
          <CardDescription>
            Están todos, no solo los que deben: el fiado sigue existiendo aunque hoy
            la cuenta esté en cero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay clientes cargados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Debe desde</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => {
                  const dias = cliente.debeDesde
                    ? Math.floor(
                        (hoy.getTime() - cliente.debeDesde.getTime()) / 86_400_000,
                      )
                    : null;

                  return (
                    <TableRow key={cliente.id}>
                      <TableCell>
                        <Link
                          href={`/clientes/${cliente.id}`}
                          className="font-medium hover:underline"
                        >
                          {cliente.nombre}
                        </Link>
                        {cliente.telefono && (
                          <span className="block text-xs text-muted-foreground">
                            {cliente.telefono}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {cliente.debeDesde ? (
                          <>
                            {FECHA_CORTA.format(cliente.debeDesde)}
                            {dias !== null && dias >= DIAS_VIEJA && (
                              <Badge variant="destructive" className="ml-2">
                                {dias} d
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cliente.saldo.isNegative() ? (
                          <>
                            <span className="font-medium">
                              {formatearPesos(cliente.saldo.abs())}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              a favor suyo
                            </span>
                          </>
                        ) : cliente.saldo.isZero() ? (
                          <span className="text-muted-foreground">al día</span>
                        ) : (
                          <span className="font-medium">{formatearPesos(cliente.saldo)}</span>
                        )}
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
