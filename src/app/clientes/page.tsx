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
import { TarjetaTotal } from "@/components/tarjeta-total";
import { FormularioCliente } from "./_components/formulario-cliente";
import { FiltrosCuentas, type EstadoCuenta } from "@/components/filtros-cuentas";
import { requerirPermiso } from "@/lib/sesion";

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

export default async function PaginaClientes(props: PageProps<"/clientes">) {
  await requerirPermiso("clientes.ver");

  const parametros = await props.searchParams;
  const consulta = textoParametro(parametros.q).trim().toLocaleLowerCase("es");
  const estado = estadoParametro(parametros.estado);
  const clientes = await clientesConSaldo();
  const hoy = new Date();
  const clientesFiltrados = clientes.filter((cliente) => {
    const coincideNombre = cliente.nombre.toLocaleLowerCase("es").includes(consulta);
    const coincideEstado =
      estado === "todos" ||
      (estado === "deuda" && esPositivo(cliente.saldo)) ||
      (estado === "favor" && cliente.saldo.isNegative()) ||
      (estado === "aldia" && cliente.saldo.isZero());
    return coincideNombre && coincideEstado;
  });

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
    <main className="app-page space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            La cuenta corriente del fiado: quién debe, cuánto y desde cuándo.
          </p>
        </div>
        <FormularioCliente />
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <TarjetaTotal
          etiqueta="Fiado sin cobrar"
          monto={formatearPesos(seDebe)}
          detalle={`Repartido entre ${deudores.length} cliente${deudores.length === 1 ? "" : "s"}`}
        />
        <TarjetaTotal
          etiqueta="Saldo a favor de clientes"
          monto={formatearPesos(aFavor)}
          detalle="Pagaron de más"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        El fiado es mercadería que salió y todavía no volvió como plata. El saldo a
        favor se descuenta solo de lo próximo que se lleven.

      </p>
      <FiltrosCuentas
        ruta="/clientes"
        consulta={textoParametro(parametros.q).trim()}
        estado={estado}
        total={clientes.length}
        mostrados={clientesFiltrados.length}
      />


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cuentas</CardTitle>
          <CardDescription>
            Están todos, no solo los que deben: el fiado sigue existiendo aunque hoy
            la cuenta esté en cero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientesFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {clientes.length === 0
                ? "Todavía no hay clientes cargados."
                : "No encontramos clientes con esos filtros."}
            </p>
          ) : (
            <>
              <ul className="space-y-3 sm:hidden">
                {clientesFiltrados.map((cliente) => {
                  const dias = cliente.debeDesde
                    ? Math.floor(
                        (hoy.getTime() - cliente.debeDesde.getTime()) / 86_400_000,
                      )
                    : null;

                  return (
                    <li key={cliente.id}>
                      <Link
                        href={`/clientes/${cliente.id}`}
                        className="block rounded-xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold">{cliente.nombre}</p>
                            {cliente.telefono && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {cliente.telefono}
                              </p>
                            )}
                          </div>
                          <div className="text-right tabular-nums">
                            <p className="font-heading text-lg font-bold">
                              {cliente.saldo.isNegative()
                                ? formatearPesos(cliente.saldo.abs())
                                : cliente.saldo.isZero()
                                  ? "Al día"
                                  : formatearPesos(cliente.saldo)}
                            </p>
                            {cliente.saldo.isNegative() && (
                              <p className="text-xs text-muted-foreground">a favor suyo</p>
                            )}
                          </div>
                        </div>
                        {cliente.debeDesde && (
                          <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3 text-xs">
                            <span className="text-muted-foreground">
                              Debe desde {FECHA_CORTA.format(cliente.debeDesde)}
                            </span>
                            {dias !== null && dias >= DIAS_VIEJA && (
                              <Badge variant="destructive">{dias} d</Badge>
                            )}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden sm:block">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Debe desde</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFiltrados.map((cliente) => {
                  const dias = cliente.debeDesde
                    ? Math.floor(
                        (hoy.getTime() - cliente.debeDesde.getTime()) / 86_400_000,
                      )
                    : null;

                  return (
                    <TableRow key={cliente.id} className="relative">
                      <TableCell>
                        <Link
                          href={`/clientes/${cliente.id}`}
                          className="font-medium outline-none after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring"
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
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function textoParametro(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : "";
}

function estadoParametro(valor: string | string[] | undefined): EstadoCuenta {
  const estado = textoParametro(valor);
  return estado === "deuda" || estado === "favor" || estado === "aldia"
    ? estado
    : "todos";
}
