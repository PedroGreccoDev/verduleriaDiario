/**
 * Total de una banda de resumen: etiqueta, número y —opcionalmente— un dato corto.
 *
 * El `detalle` tiene que entrar en UNA línea. Cualquier texto que varíe de largo
 * entre una tarjeta y otra las deja de distinta altura dentro de la misma grilla,
 * que es justo lo que hay que evitar. Las aclaraciones largas van abajo de la
 * grilla, no adentro de una tarjeta.
 */
export function TarjetaTotal({
  etiqueta,
  monto,
  detalle,
}: {
  etiqueta: string;
  monto: string;
  detalle?: string;
}) {
  return (
    <div data-slot="total" className="min-w-0 py-5 sm:px-5 sm:py-6 sm:first:pl-0 sm:last:pr-0">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {etiqueta}
      </p>
      <p className="mt-1 font-heading text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.7rem]">
        {monto}
      </p>
      {detalle && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{detalle}</p>
      )}
    </div>
  );
}
