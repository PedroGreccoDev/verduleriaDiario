import Link from "next/link";
import { esPreset, periodoDe, periodoPersonalizado, ultimoDiaIncluido, type Periodo, type Preset } from "@/domain/caja/periodo";
import { categoriasParaFiltrar, reporteIngresosEgresos } from "@/domain/caja/reportes";
import { formatearPesos } from "@/lib/formato";
import { formatearFecha, soloFecha } from "@/lib/fecha";
import { Button } from "@/components/ui/button";
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
  title: "Ingresos y egresos — Estación Verde",
};

const ETIQUETA_PRESET: Record<Preset, string> = {
  dia: "Día",
  semana: "Semana",
  mes: "Mes",
  anio: "Año",
  personalizado: "Personalizado",
};

const FECHA_LARGA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const FECHA_Y_HORA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const CLASE_SELECT =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs";

function primerValor(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : "";
}

export default async function PaginaReporte(props: PageProps<"/reportes">) {
  const parametros = await props.searchParams;

  const presetPedido = primerValor(parametros.preset);
  const preset: Preset = esPreset(presetPedido) ? presetPedido : "dia";

  const fechaTexto = primerValor(parametros.fecha) || formatearFecha(soloFecha());
  const desdeTexto = primerValor(parametros.desde);
  const hastaTexto = primerValor(parametros.hasta);

  const tipo = primerValor(parametros.tipo);
  const categoriaId = primerValor(parametros.categoria);

  const referencia = referenciaDeTexto(fechaTexto);
  const periodo: Periodo | null =
    preset === "personalizado"
      ? periodoPersonalizado(desdeTexto, hastaTexto)
      : periodoDe(preset, referencia);

  const categorias = await categoriasParaFiltrar();
  const reporte = periodo
    ? await reporteIngresosEgresos({
        periodo,
        tipo: tipo === "ingreso" || tipo === "egreso" ? tipo : null,
        categoriaId: categoriaId || null,
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Ingresos y egresos</h1>
        <p className="text-sm text-muted-foreground">
          Movimientos de la Bolsa Grande. No son ventas —el sistema no las
          registra— ni incluye la cartera de cheques, que se mide a nominal.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Período</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ETIQUETA_PRESET) as Preset[]).map((opcion) => (
              <Button
                key={opcion}
                asChild
                size="sm"
                variant={opcion === preset ? "default" : "outline"}
              >
                <Link
                  href={{
                    pathname: "/reportes",
                    query: {
                      preset: opcion,
                      fecha: fechaTexto,
                      ...(desdeTexto ? { desde: desdeTexto } : {}),
                      ...(hastaTexto ? { hasta: hastaTexto } : {}),
                      ...(tipo ? { tipo } : {}),
                      ...(categoriaId ? { categoria: categoriaId } : {}),
                    },
                  }}
                >
                  {ETIQUETA_PRESET[opcion]}
                </Link>
              </Button>
            ))}
          </div>

          {/* Formulario GET: los filtros viven en la URL, así una vista se puede
              guardar en favoritos o mandar por mensaje y abre igual. */}
          <form method="get" className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <input type="hidden" name="preset" value={preset} />

            {preset === "personalizado" ? (
              <>
                <Campo etiqueta="Desde">
                  <input
                    type="date"
                    name="desde"
                    defaultValue={desdeTexto}
                    className={CLASE_SELECT}
                  />
                </Campo>
                <Campo etiqueta="Hasta">
                  <input
                    type="date"
                    name="hasta"
                    defaultValue={hastaTexto}
                    className={CLASE_SELECT}
                  />
                </Campo>
              </>
            ) : (
              <Campo etiqueta={preset === "dia" ? "Día" : "Día de referencia"}>
                <input
                  type="date"
                  name="fecha"
                  defaultValue={fechaTexto}
                  className={CLASE_SELECT}
                />
              </Campo>
            )}

            <Campo etiqueta="Tipo">
              <select name="tipo" defaultValue={tipo} className={CLASE_SELECT}>
                <option value="">Todos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
              </select>
            </Campo>

            <Campo etiqueta="Categoría">
              <select name="categoria" defaultValue={categoriaId} className={CLASE_SELECT}>
                <option value="">Todas</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <Button type="submit" variant="secondary">
              Aplicar
            </Button>
          </form>
        </CardContent>
      </Card>

      {periodo === null || reporte === null ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              {desdeTexto || hastaTexto
                ? "Ese rango no se entiende: revisá que las dos fechas existan y que el desde no sea posterior al hasta."
                : "Elegí desde qué día y hasta qué día querés el reporte."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {describirPeriodo(periodo)}
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Ingresos</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatearPesos(reporte.totalIngresos)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Egresos</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatearPesos(reporte.totalEgresos)}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Neto del período</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatearPesos(reporte.neto)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Lo que entró menos lo que salió en estos días. No es la plata que
                  hay en la Bolsa Grande.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {reporte.movimientos.length} movimiento
                {reporte.movimientos.length === 1 ? "" : "s"}
              </CardTitle>
              <CardDescription>Del más reciente al más viejo.</CardDescription>
            </CardHeader>
            <CardContent>
              {reporte.movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hubo movimientos en este período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuándo</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporte.movimientos.map((movimiento) => (
                      <TableRow key={movimiento.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {FECHA_Y_HORA.format(movimiento.fecha)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{movimiento.categoria}</span>
                          {movimiento.observacion && (
                            <span className="block text-xs text-muted-foreground">
                              {movimiento.observacion}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {movimiento.turno?.nombre ?? "fuera de turno"}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${
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
        </>
      )}
    </main>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-muted-foreground">{etiqueta}</span>
      {children}
    </label>
  );
}

/** "2026-08-14" → ese día. Cualquier otra cosa cae en hoy. */
function referenciaDeTexto(texto: string): Date {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return new Date();

  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
}

function describirPeriodo(periodo: Periodo): string {
  const ultimo = ultimoDiaIncluido(periodo);

  return periodo.desde.getTime() === ultimo.getTime()
    ? FECHA_LARGA.format(periodo.desde)
    : `Del ${FECHA_LARGA.format(periodo.desde)} al ${FECHA_LARGA.format(ultimo)}`;
}
