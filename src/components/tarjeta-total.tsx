import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Tarjeta de total: etiqueta, número y —opcionalmente— un dato corto.
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
    <Card className="gap-1">
      <CardHeader>
        <CardDescription>{etiqueta}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{monto}</CardTitle>
      </CardHeader>
      {detalle && (
        <CardContent>
          <p className="truncate text-xs text-muted-foreground">{detalle}</p>
        </CardContent>
      )}
    </Card>
  );
}
