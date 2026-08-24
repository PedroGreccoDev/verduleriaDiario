import { categoriasParaCargarAMano, obtenerEstadoCaja } from "@/domain/caja/consultas";
import { formatearFechaLarga, formatearHora, formatearPesos } from "@/lib/formato";
import { soloFecha } from "@/lib/fecha";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListaMovimientos } from "./_components/lista-movimientos";
import { FormularioAbrirTurno } from "./_components/formulario-abrir-turno";
import { FormularioRetiro } from "./_components/formulario-retiro";
import { FormularioCerrarTurno } from "./_components/formulario-cerrar-turno";
import { FormularioMovimientoManual } from "./_components/formulario-movimiento-manual";
import { puede, requerirPermiso } from "@/lib/sesion";

// Lee el estado de la caja en cada request. Sin esto Next lo prerenderizaría en el
// build y la pantalla mostraría el turno que estaba abierto al momento de compilar.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caja por turno — Estación Verde",
};

export default async function PaginaCaja() {
  const usuario = await requerirPermiso("caja.ver");

  // Quien no puede cargar tampoco ve los formularios. Las Server Actions lo
  // rechazarían igual, pero un botón que siempre da error es peor que no estar.
  const puedeCargar = puede(usuario, "caja.cargar");
  const puedeGestionarTurno = puede(usuario, "turno.gestionar");

  const estado = await obtenerEstadoCaja();
  const categorias = await categoriasParaCargarAMano();
  const { turnoAbierto } = estado;

  // Se carga con turno abierto y sin él: §3.1 admite movimientos fuera de turno, y
  // la nafta se paga a las 7 de la mañana, antes de que nadie abra nada.
  const formularioMovimiento = !puedeCargar ? null : (
    <FormularioMovimientoManual
      categorias={categorias.map((categoria) => ({
        id: categoria.id,
        nombre: categoria.nombre,
        tipo: categoria.tipo,
      }))}
      hayTurnoAbierto={turnoAbierto !== null}
    />
  );

  return (
    <main className="app-page space-y-8">
      {!turnoAbierto && (
        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Caja</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {/* `soloFecha` primero: `formatearFechaLarga` formatea en UTC, así que un
                `new Date()` crudo del turno tarde muestra el día siguiente. */}
            {formatearFechaLarga(soloFecha())}
          </p>
        </header>
      )}

      {turnoAbierto ? (
        <>
          <section className="overflow-hidden rounded-2xl bg-sidebar text-sidebar-foreground shadow-[0_18px_45px_rgba(25,48,37,0.16)]">
            <div className="px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex items-start gap-3">
                <span
                  className="mt-1.5 size-2.5 shrink-0 rounded-full bg-sidebar-primary shadow-[0_0_0_5px_rgba(145,204,27,0.12)]"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                    Caja abierta
                  </p>
                  <h1 className="mt-1 font-heading text-2xl font-bold capitalize">
                    Turno {turnoAbierto.nombre}
                  </h1>
                  <p className="mt-1 text-sm text-white/58 first-letter:uppercase">
                    {formatearFechaLarga(soloFecha())} · abierto a las{" "}
                    {formatearHora(turnoAbierto.fechaApertura)}
                    {turnoAbierto.autor ? ` por ${turnoAbierto.autor}` : ""}
                    {turnoAbierto.observacion ? ` · ${turnoAbierto.observacion}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <dl className="grid border-t border-white/10 bg-black/8 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
              <Total etiqueta="Retirado a Bolsa Grande" monto={estado.totalRetirado} oscuro />
              <Total
                etiqueta="Otros ingresos"
                monto={estado.totalIngresos.minus(estado.totalRetirado)}
                oscuro
              />
              <Total etiqueta="Egresos" monto={estado.totalEgresos} oscuro />
            </dl>
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
            <aside className="space-y-4 xl:order-2 xl:sticky xl:top-6">
              {puedeCargar && (
                <Card>
                  <CardHeader>
                    <CardTitle>Registrar movimiento</CardTitle>
                    <CardDescription>
                      Cargá lo que entra o sale de la caja.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="retiro">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="retiro">Retiro</TabsTrigger>
                        <TabsTrigger value="otro">Otro movimiento</TabsTrigger>
                      </TabsList>
                      <TabsContent value="retiro" className="space-y-4">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Pasa efectivo de la registradora a la Bolsa Grande.
                        </p>
                        <FormularioRetiro turnoId={turnoAbierto.id} />
                      </TabsContent>
                      <TabsContent value="otro" className="space-y-4">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Nafta, arreglos o plata que pone o saca un socio.
                        </p>
                        {formularioMovimiento}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {puedeGestionarTurno && (
                <details className="group overflow-hidden rounded-xl border border-border bg-card/65">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium marker:hidden">
                    Finalizar turno
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                      className="size-4 transition-transform group-open:rotate-180"
                    >
                      <path d="m6 8 4 4 4-4" />
                    </svg>
                  </summary>
                  <div className="border-t border-border px-4 py-4">
                    <FormularioCerrarTurno turnoId={turnoAbierto.id} />
                  </div>
                </details>
              )}
            </aside>

          <Card className="xl:order-1">
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
                <ListaMovimientos
                  movimientos={[...estado.movimientos].reverse().map((movimiento) => ({
                    id: movimiento.id,
                    hora: formatearHora(movimiento.fecha),
                    tipo: movimiento.tipo,
                    categoria: movimiento.categoria,
                    monto: formatearPesos(movimiento.monto),
                    observacion: movimiento.observacion,
                    autor: movimiento.autor,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          </div>
        </>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No hay ningún turno abierto</CardTitle>
              <CardDescription>
                {!puedeGestionarTurno
                  ? "Los turnos los abre otra persona."
                  : estado.proximoSugerido
                    ? `Hoy corresponde el turno ${estado.proximoSugerido}.`
                    : "Hoy ya se abrieron todos los turnos habituales."}
              </CardDescription>
            </CardHeader>
            {puedeGestionarTurno && (
              <CardContent>
                <FormularioAbrirTurno
                  sugeridos={estado.sugeridos}
                  proximoSugerido={estado.proximoSugerido}
                />
              </CardContent>
            )}
          </Card>

          {formularioMovimiento && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gasto o ingreso suelto</CardTitle>
                <CardDescription>
                  Podés registrar movimientos aunque todavía no haya un turno abierto.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {formularioMovimiento}
              </CardContent>
            </Card>
          )}
        </div>
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
  oscuro = false,
}: {
  etiqueta: string;
  monto: Awaited<ReturnType<typeof obtenerEstadoCaja>>["totalIngresos"];
  oscuro?: boolean;
}) {
  return (
    <div className="px-5 py-4 sm:px-7 sm:py-5">
      <dt className={`text-xs ${oscuro ? "text-white/48" : "text-muted-foreground"}`}>
        {etiqueta}
      </dt>
      <dd
        className={`mt-1 font-heading text-xl font-bold tabular-nums ${
          oscuro ? "text-white" : ""
        }`}
      >
        {formatearPesos(monto)}
      </dd>
    </div>
  );
}
