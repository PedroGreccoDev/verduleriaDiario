import { obtenerEstadoCaja } from "@/domain/caja/consultas";
import { formatearFechaLarga, formatearHora, formatearPesos } from "@/lib/formato";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormularioAbrirTurno } from "./_components/formulario-abrir-turno";
import { FormularioRetiro } from "./_components/formulario-retiro";
import { FormularioCerrarTurno } from "./_components/formulario-cerrar-turno";

// Lee el estado de la caja en cada request. Sin esto Next lo prerenderizaría en el
// build y la pantalla mostraría el turno que estaba abierto al momento de compilar.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caja por turno — Estación Verde",
};

export default async function PaginaCaja() {
  const estado = await obtenerEstadoCaja();
  const { turnoAbierto } = estado;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Caja por turno</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {formatearFechaLarga(new Date())}
        </p>
      </header>

      {turnoAbierto ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="capitalize">
                    Turno {turnoAbierto.nombre}
                  </CardTitle>
                  <CardDescription>
                    Abierto a las {formatearHora(turnoAbierto.fechaApertura)}
                    {turnoAbierto.observacion ? ` · ${turnoAbierto.observacion}` : ""}
                  </CardDescription>
                </div>
                <Badge>Abierto</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Total etiqueta="Retirado a la Bolsa Grande" monto={estado.totalRetirado} />
                <Total etiqueta="Otros ingresos" monto={estado.totalIngresos.minus(estado.totalRetirado)} />
                <Total etiqueta="Egresos" monto={estado.totalEgresos} />
              </dl>

              <Separator />

              <section className="space-y-3">
                <h2 className="text-sm font-medium">Registrar un retiro</h2>
                <p className="text-xs text-muted-foreground">
                  El efectivo pasa de la registradora a la Bolsa Grande. Podés hacer
                  varios retiros parciales durante el turno.
                </p>
                <FormularioRetiro turnoId={turnoAbierto.id} />
              </section>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movimientos del turno</CardTitle>
              <CardDescription>
                Solo movimientos de la Bolsa Grande. El sistema no registra ventas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {estado.movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay movimientos en este turno.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Hora</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estado.movimientos.map((movimiento) => (
                      <TableRow key={movimiento.id}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {formatearHora(movimiento.fecha)}
                        </TableCell>
                        <TableCell>
                          <span>{movimiento.categoria}</span>
                          {movimiento.observacion && (
                            <span className="block text-xs text-muted-foreground">
                              {movimiento.observacion}
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            movimiento.tipo === "egreso" ? "text-destructive" : ""
                          }`}
                        >
                          {movimiento.tipo === "egreso" ? "−" : "+"}
                          {formatearPesos(movimiento.monto)}
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
              <CardTitle className="text-base">Cerrar el turno</CardTitle>
            </CardHeader>
            <CardContent>
              <FormularioCerrarTurno turnoId={turnoAbierto.id} />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No hay ningún turno abierto</CardTitle>
            <CardDescription>
              {estado.proximoSugerido
                ? `Hoy corresponde el turno ${estado.proximoSugerido}.`
                : "Hoy ya se abrieron todos los turnos habituales."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioAbrirTurno
              sugeridos={estado.sugeridos}
              proximoSugerido={estado.proximoSugerido}
            />
          </CardContent>
        </Card>
      )}

      {estado.turnosDelDia.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Turnos de hoy</h2>
          <ul className="flex flex-wrap gap-2">
            {estado.turnosDelDia.map((turno) => (
              <li key={turno.id}>
                <Badge variant={turno.estado === "abierto" ? "default" : "secondary"}>
                  <span className="capitalize">{turno.nombre}</span>
                  {turno.fechaCierre && ` · cerrado ${formatearHora(turno.fechaCierre)}`}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Total({
  etiqueta,
  monto,
}: {
  etiqueta: string;
  monto: Awaited<ReturnType<typeof obtenerEstadoCaja>>["totalIngresos"];
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="text-lg font-semibold tabular-nums">{formatearPesos(monto)}</dd>
    </div>
  );
}
