import Link from "next/link";
import { notFound } from "next/navigation";
import { cuentaDeCliente } from "@/domain/clientes/consultas";
import { obtenerTurnoAbierto } from "@/domain/caja/turno.service";
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
import { FormularioMovimiento } from "../_components/formulario-movimiento";
import { requerirPermiso } from "@/lib/sesion";

export const dynamic = "force-dynamic";

const FECHA_Y_HORA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const FECHA_LARGA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

export default async function PaginaCuentaCliente(
  props: PageProps<"/clientes/[clienteId]">,
) {
  await requerirPermiso("clientes.ver");
  const { clienteId } = await props.params;

  const cuenta = await cuentaDeCliente(clienteId);
  if (!cuenta) notFound();

  const { cliente } = cuenta;
  const turnoAbierto = await obtenerTurnoAbierto();
  const aFavor = cliente.saldo.isNegative() ? cliente.saldo.abs() : null;

  return (
    <main className="app-page app-page-medium space-y-8">
      <header className="space-y-1">
        <Link href="/clientes" className="text-sm text-muted-foreground hover:underline">
          ← Clientes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold">{cliente.nombre}</h1>
          {!cliente.activo && <Badge variant="outline">dado de baja</Badge>}
        </div>
        {cliente.telefono && (
          <p className="text-sm text-muted-foreground">{cliente.telefono}</p>
        )}
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>
            {aFavor ? "Tiene a favor" : cliente.saldo.isZero() ? "Está al día" : "Debe"}
          </CardDescription>
          <CardTitle className="text-3xl tabular-nums">
            {formatearPesos(aFavor ?? cliente.saldo)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {cuenta.debeDesde
              ? `Arrastra esta deuda desde el ${FECHA_LARGA.format(cuenta.debeDesde)}.`
              : aFavor
                ? "Pagó de más: se descuenta solo de lo próximo que se lleve."
                : "No debe nada."}{" "}
            Se llevó {formatearPesos(cuenta.totalFiado)} en total y pagó{" "}
            {formatearPesos(cuenta.totalPagado)}.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fiar</CardTitle>
            <CardDescription>Se lleva mercadería y queda debiendo.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioMovimiento
              clienteId={cliente.id}
              modo="fiar"
              saldoActual={cliente.saldo.toFixed(0)}
              hayTurnoAbierto={turnoAbierto !== null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cobrar</CardTitle>
            <CardDescription>Paga su cuenta: entra efectivo a la caja.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioMovimiento
              clienteId={cliente.id}
              modo="cobrar"
              saldoActual={cliente.saldo.toFixed(0)}
              hayTurnoAbierto={turnoAbierto !== null}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos</CardTitle>
          <CardDescription>
            Cada línea muestra cómo quedó la cuenta después de ese movimiento, para
            poder mostrárselo al cliente sin rehacer la suma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cuenta.movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no tiene movimientos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuándo</TableHead>
                  <TableHead>Qué pasó</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Quedó debiendo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuenta.movimientos.map((movimiento) => (
                  <TableRow key={movimiento.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {FECHA_Y_HORA.format(movimiento.fecha)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {movimiento.tipo === "cargo" ? "Se llevó" : "Pagó"}
                      </span>
                      {movimiento.observacion && (
                        <span className="block text-xs text-muted-foreground">
                          {movimiento.observacion}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-medium ${
                        movimiento.tipo === "cargo" ? "text-destructive" : ""
                      }`}
                    >
                      {movimiento.tipo === "cargo" ? "+" : "−"}
                      {formatearPesos(movimiento.monto)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {movimiento.saldoResultante.isNegative()
                        ? `${formatearPesos(movimiento.saldoResultante.abs())} a favor`
                        : formatearPesos(movimiento.saldoResultante)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
