import Link from "next/link";
import { notFound } from "next/navigation";
import { cuentaDeProveedor } from "@/domain/proveedores/consultas";
import { facturasPendientes } from "@/domain/proveedores/factura.service";
import { obtenerTurnoAbierto } from "@/domain/caja/turno.service";
import { CERO } from "@/lib/decimal";
import { formatearPesos } from "@/lib/formato";
import { formatearFecha, soloFecha } from "@/lib/fecha";
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
import { FormularioFactura } from "../_components/formulario-factura";
import { FormularioPagoEfectivo } from "../_components/formulario-pago-efectivo";

export const dynamic = "force-dynamic";

const FECHA_CORTA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

const FECHA_Y_HORA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "pendiente",
  parcial: "parcial",
  pagada: "pagada",
};

export default async function PaginaCuentaProveedor(
  props: PageProps<"/proveedores/[proveedorId]">,
) {
  const { proveedorId } = await props.params;

  const cuenta = await cuentaDeProveedor(proveedorId);
  if (!cuenta) notFound();

  const { proveedor } = cuenta;
  const pendientes = await facturasPendientes(proveedorId);
  const turnoAbierto = await obtenerTurnoAbierto();

  const credito = proveedor.saldo.isNegative() ? proveedor.saldo.abs() : null;

  return (
    <main className="w-full max-w-4xl px-5 py-6 sm:px-8 md:px-10 md:py-10 space-y-6">
      <header className="space-y-1">
        <Link href="/proveedores" className="text-sm text-muted-foreground hover:underline">
          ← Proveedores
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold">{proveedor.nombre}</h1>
          {!proveedor.activo && <Badge variant="outline">dado de baja</Badge>}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <TarjetaTotal
          etiqueta={credito ? "Saldo a favor nuestro" : "Se le debe"}
          monto={formatearPesos(credito ?? proveedor.saldo)}
          detalle="Cuenta corriente"
        />
        <TarjetaTotal
          etiqueta="Facturas pendientes"
          monto={formatearPesos(cuenta.deudaPendiente)}
          detalle={
            pendientes.length === 0
              ? "Ninguna sin saldar"
              : `Repartidos en ${pendientes.length} factura${pendientes.length === 1 ? "" : "s"}`
          }
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {credito
          ? "Ya se le entregó de más. Ese saldo a favor se descuenta solo de la próxima factura que cargues."
          : "El saldo de cuenta corriente incluye lo que todavía no se imputó a ninguna factura."}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cargar factura</CardTitle>
          <CardDescription>Lo que el proveedor entregó y todavía no se pagó.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioFactura
            proveedorId={proveedor.id}
            creditoDisponible={(credito ?? CERO).toFixed(0)}
            hoy={formatearFecha(soloFecha())}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pagar en efectivo</CardTitle>
          <CardDescription>
            Sale plata de la Bolsa Grande. Para pagar con un cheque de la cartera,
            andá a <Link href="/cheques" className="underline">Cheques</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioPagoEfectivo
            proveedorId={proveedor.id}
            hayTurnoAbierto={turnoAbierto !== null}
            facturas={pendientes.map((factura) => ({
              id: factura.id,
              numero: factura.numero,
              saldoPendiente: factura.saldoPendiente.toFixed(0),
              vencimiento: factura.fechaVencimiento
                ? FECHA_CORTA.format(factura.fechaVencimiento)
                : null,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facturas</CardTitle>
          <CardDescription>
            Van todas, no solo las pendientes: una factura pagada es la prueba de que
            se pagó.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cuenta.facturas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no cargaste ninguna.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuenta.facturas.map((factura) => (
                  <TableRow key={factura.id}>
                    <TableCell>
                      <span className="font-medium">{factura.numero}</span>
                      <span className="block text-xs text-muted-foreground">
                        {FECHA_CORTA.format(factura.fecha)} ·{" "}
                        {ETIQUETA_ESTADO[factura.estado] ?? factura.estado}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {factura.fechaVencimiento ? (
                        FECHA_CORTA.format(factura.fechaVencimiento)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatearPesos(factura.montoTotal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {factura.saldoPendiente.isZero() ? (
                        <span className="font-normal text-muted-foreground">saldada</span>
                      ) : (
                        formatearPesos(factura.saldoPendiente)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pagos</CardTitle>
          <CardDescription>
            Efectivo y cheques entregados. Los montos no se suman entre sí: uno es
            plata que salió de la caja y el otro es nominal de cheque.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cuenta.pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no se le pagó nada.</p>
          ) : (
            <ul className="divide-y">
              {cuenta.pagos.map((pago) => (
                <li key={pago.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {pago.medio === "cheque" && pago.cheque
                        ? `Cheque ${pago.cheque.banco} ${pago.cheque.numero}`
                        : pago.medio === "efectivo"
                          ? "Efectivo"
                          : pago.medio}
                      {pago.cheque?.rechazado && (
                        <Badge variant="destructive" className="ml-2">
                          rebotó
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {FECHA_Y_HORA.format(pago.fecha)}
                      {pago.observacion && ` · ${pago.observacion}`}
                    </p>
                    {pago.cheque?.rechazado && (
                      <p className="text-xs text-muted-foreground">
                        Lo levanta quien te lo vendió: la deuda con {proveedor.nombre}{" "}
                        sigue saldada.
                      </p>
                    )}
                  </div>
                  <span className="tabular-nums text-sm font-medium whitespace-nowrap">
                    {formatearPesos(pago.monto)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
