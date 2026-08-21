import Link from "next/link";
import { proveedoresConDeuda } from "@/domain/proveedores/consultas";
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

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proveedores — Estación Verde",
};

const FECHA_CORTA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC", // los `@db.Date` ya vienen como medianoche UTC del día local
});

/** Un vencimiento a menos de esto ya es algo que hay que mirar hoy. */
const DIAS_URGENTE = 7;

export default async function PaginaProveedores() {
  const proveedores = await proveedoresConDeuda();
  const hoy = new Date();

  // Deuda y crédito se muestran separados, nunca netos: deberle $100.000 a uno y
  // tener $30.000 a favor con otro no es "deber $70.000". Son dos cuentas
  // distintas con dos personas distintas, y ninguna cancela a la otra (§3.3).
  const conDeuda = proveedores.filter((p) => esPositivo(p.saldo));
  const conCredito = proveedores.filter((p) => p.saldo.isNegative());
  const seDebe = conDeuda.reduce((total, p) => total.plus(p.saldo), CERO);
  const aFavor = conCredito.reduce((total, p) => total.plus(p.saldo.abs()), CERO);

  return (
    <main className="w-full max-w-4xl px-5 py-6 sm:px-8 md:px-10 md:py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Lo que se le debe a cada uno y qué facturas quedan pendientes.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <TarjetaTotal
          etiqueta="Deuda total"
          monto={formatearPesos(seDebe)}
          detalle={`A ${conDeuda.length} proveedor${conDeuda.length === 1 ? "" : "es"}`}
        />
        <TarjetaTotal
          etiqueta="Saldo a favor"
          monto={formatearPesos(aFavor)}
          detalle={`Con ${conCredito.length} proveedor${conCredito.length === 1 ? "" : "es"}`}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Los dos totales van separados: el saldo a favor que haya con uno no se
        descuenta de lo que se le debe a otro. Cada saldo a favor se descuenta solo
        de la próxima factura de ese mismo proveedor.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cuentas</CardTitle>
          <CardDescription>
            Los que no deben nada también aparecen: uno con saldo a favor es plata
            nuestra adelantada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {proveedores.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay proveedores activos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proveedores.map((proveedor) => {
                  const diasParaVencer = proveedor.proximoVencimiento
                    ? Math.round(
                        (proveedor.proximoVencimiento.getTime() - hoy.getTime()) /
                          86_400_000,
                      )
                    : null;

                  return (
                    <TableRow key={proveedor.id}>
                      <TableCell>
                        <Link
                          href={`/proveedores/${proveedor.id}`}
                          className="font-medium hover:underline"
                        >
                          {proveedor.nombre}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {proveedor.facturasPendientes === 0
                            ? "sin facturas pendientes"
                            : `${proveedor.facturasPendientes} factura${proveedor.facturasPendientes === 1 ? "" : "s"} pendiente${proveedor.facturasPendientes === 1 ? "" : "s"}`}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {proveedor.proximoVencimiento ? (
                          <>
                            {FECHA_CORTA.format(proveedor.proximoVencimiento)}
                            {diasParaVencer !== null &&
                              diasParaVencer <= DIAS_URGENTE && (
                                <Badge variant="destructive" className="ml-2">
                                  {diasParaVencer < 0
                                    ? "vencida"
                                    : `${diasParaVencer} d`}
                                </Badge>
                              )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {proveedor.saldo.isNegative() ? (
                          <>
                            <span className="font-medium">
                              {formatearPesos(proveedor.saldo.abs())}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              a favor nuestro
                            </span>
                          </>
                        ) : proveedor.saldo.isZero() ? (
                          <span className="text-muted-foreground">al día</span>
                        ) : (
                          <span className="font-medium">
                            {formatearPesos(proveedor.saldo)}
                          </span>
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
