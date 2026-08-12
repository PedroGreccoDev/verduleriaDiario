import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ResultadoAccion } from "../actions";

/**
 * Los mensajes vienen del dominio, que los escribe pensando en el operador:
 * dicen qué pasó y qué hacer, no un código.
 */
export function MensajeError({ resultado }: { resultado: ResultadoAccion }) {
  if (resultado.ok || !resultado.mensaje) return null;

  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{resultado.mensaje}</AlertDescription>
    </Alert>
  );
}
