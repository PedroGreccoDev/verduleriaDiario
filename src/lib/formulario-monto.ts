import { dec, type Decimal } from "./decimal";
import { ErrorDominio } from "./errores";
import { normalizarMontoTexto } from "./monto-texto";

/**
 * Convierte lo que tipeó el operador en Decimal, o explica por qué no se puede.
 *
 * Vive acá y no en cada `actions.ts` porque el mensaje de los centavos importa:
 * "45.000,50" se ve como un monto perfectamente válido, y si cada pantalla lo
 * rechazara con un texto distinto —o peor, con un genérico "monto inválido"— el
 * operador no tendría forma de saber qué le molestó al sistema.
 *
 * Los centavos se rechazan, nunca se truncan (ver AGENTS.md): quien escribió
 * "45.000,50" quiso decir algo, y guardarle $45.000 sin avisar es cambiarle el
 * monto por la espalda.
 */
export function montoDeFormulario(valor: string, campo?: string): Decimal {
  const canonico = normalizarMontoTexto(valor);

  if (canonico === null) {
    const prefijo = campo ? `${campo}: ` : "";

    throw new ErrorDominio(
      "MONTO_INVALIDO",
      valor.includes(",")
        ? `${prefijo}"${valor}" tiene centavos. Los montos van en pesos enteros.`
        : `${prefijo}"${valor}" no es un monto válido.`,
    );
  }

  return dec(canonico);
}
