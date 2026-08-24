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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import { TarjetaTotal } from "@/components/tarjeta-total";
import { requerirPermiso } from "@/lib/sesion";

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

// Radix Select no admite value="" (lo reserva para "sin selección"), así que
// "todos"/"todas" viajan en la URL con este valor y se traducen acá mismo a "".
const SENTINEL_TIPO = "__todos__";
const SENTINEL_CATEGORIA = "__todas__";

function primerValor(valor: string | string[] | undefined): string {
  return typeof valor === "string" ? valor : "";
}

export default async function PaginaReporte(props: PageProps<"/reportes">) {
  await requerirPermiso("reportes.ver");
  const parametros = await props.searchParams;

  const presetPedido = primerValor(parametros.preset);
  const preset: Preset = esPreset(presetPedido) ? presetPedido : "dia";

  const fechaTexto = primerValor(parametros.fecha) || formatearFecha(soloFecha());
  const desdeTexto = primerValor(parametros.desde);
  const hastaTexto = primerValor(parametros.hasta);

  const tipoParam = primerValor(parametros.tipo);
  const tipo = tipoParam === SENTINEL_TIPO ? "" : tipoParam;
  const categoriaParam = primerValor(parametros.categoria);
  const categoriaId = categoriaParam === SENTINEL_CATEGORIA ? "" : categoriaParam;

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
    <main className="app-page space-y-8">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Ingresos y egresos</h1>
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
                  <DatePicker name="desde" defaultValue={desdeTexto} />
                </Campo>
                <Campo etiqueta="Hasta">
                  <DatePicker name="hasta" defaultValue={hastaTexto} />
                </Campo>
              </>
            ) : (
              <Campo etiqueta={preset === "dia" ? "Día" : "Día de referencia"}>
                <DatePicker name="fecha" defaultValue={fechaTexto} />
              </Campo>
            )}

            <Campo etiqueta="Tipo">
              <Select name="tipo" defaultValue={tipo || SENTINEL_TIPO}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SENTINEL_TIPO}>Todos</SelectItem>
                  <SelectItem value="ingreso">Ingresos</SelectItem>
                  <SelectItem value="egreso">Egresos</SelectItem>
                </SelectContent>
              </Select>
            </Campo>

            <Campo etiqueta="Categoría">
              <Select name="categoria" defaultValue={categoriaId || SENTINEL_CATEGORIA}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SENTINEL_CATEGORIA}>Todas</SelectItem>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          {/* Tarjetas de total: etiqueta y número, nada más. Cualquier texto que
              varíe de largo entre una y otra las deja de distinta altura, así que
              la aclaración del neto va abajo de la grilla y no adentro de una. */}
          <div className="grid gap-4 sm:grid-cols-3">
            <TarjetaTotal etiqueta="Ingresos" monto={formatearPesos(reporte.totalIngresos)} />
            <TarjetaTotal etiqueta="Egresos" monto={formatearPesos(reporte.totalEgresos)} />
            <TarjetaTotal etiqueta="Neto del período" monto={formatearPesos(reporte.neto)} />
          </div>

          <p className="text-xs text-muted-foreground">
            El neto es lo que entró menos lo que salió en estos días. No es la plata
            que hay en la Bolsa Grande.
          </p>

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
                <>
                  <ul className="space-y-3 sm:hidden">
                    {reporte.movimientos.map((movimiento) => (
                      <li
                        key={movimiento.id}
                        className="rounded-xl border border-border bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium">{movimiento.categoria}</p>
                            {movimiento.observacion && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {movimiento.observacion}
                              </p>
                            )}
                          </div>
                          <p
                            className={`font-heading text-lg font-bold tabular-nums ${
                              movimiento.tipo === "egreso" ? "text-destructive" : ""
                            }`}
                          >
                            {movimiento.tipo === "egreso" ? "−" : "+"}
                            {formatearPesos(movimiento.monto)}
                          </p>
                        </div>
                        <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                          {FECHA_Y_HORA.format(movimiento.fecha)} · {movimiento.turno?.nombre ?? "fuera de turno"}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden sm:block">
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
                  </div>
                </>
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
