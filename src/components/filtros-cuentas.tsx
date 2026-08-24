import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type EstadoCuenta = "todos" | "deuda" | "favor" | "aldia";

export function FiltrosCuentas({
  ruta,
  consulta,
  estado,
  total,
  mostrados,
}: {
  ruta: string;
  consulta: string;
  estado: EstadoCuenta;
  total: number;
  mostrados: number;
}) {
  const hayFiltros = consulta !== "" || estado !== "todos";

  return (
    <section aria-label="Buscar y filtrar cuentas" className="rounded-2xl border border-border/80 bg-white/75 p-4 shadow-sm backdrop-blur-sm">
      <form method="get" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Buscar</span>
          <Input
            type="search"
            name="q"
            defaultValue={consulta}
            placeholder="Nombre"
            autoComplete="off"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Estado</span>
          <select
            name="estado"
            defaultValue={estado}
            className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
          >
            <option value="todos">Todos</option>
            <option value="deuda">Con deuda</option>
            <option value="favor">Saldo a favor</option>
            <option value="aldia">Al día</option>
          </select>
        </label>

        <Button type="submit">Aplicar</Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {hayFiltros ? `Mostrando ${mostrados} de ${total}` : `${total} cuenta${total === 1 ? "" : "s"}`}
        </span>
        {hayFiltros && (
          <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs">
            <Link href={ruta}>Limpiar filtros</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
