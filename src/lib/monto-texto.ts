/**
 * Traducción entre lo que tipea el operador y un número canónico.
 *
 * Módulo puro, SIN dependencias: lo usan tanto las Server Actions como los
 * componentes del navegador. Que sea el mismo código de los dos lados no es
 * prolijidad — es lo que garantiza que el monto que la pantalla muestra para
 * confirmar sea exactamente el que se va a guardar.
 */

/**
 * Normaliza un monto escrito a la argentina: punto de miles, coma decimal.
 * "128.450,75" → "128450.75". Acepta también "128450.75" tal cual.
 *
 * Devuelve `null` si no es un monto válido, para que quien llama decida el error.
 *
 * EL CASO AMBIGUO: un punto solo, sin coma. "1.000" puede leerse como mil o como
 * uno con cero decimales. Se resuelve por la cantidad de dígitos que siguen:
 *
 *   - exactamente 3  → separador de miles  ("1.000" = mil)
 *   - 1 o 2          → separador decimal   ("45.50" = cuarenta y cinco con cincuenta)
 *
 * Es la convención argentina, y el caso contrario no existe en la práctica: nadie
 * carga un monto de un peso con tres decimales. Sin esta regla, escribir un millón
 * como "1.000.000" —que es como lo escribe cualquiera— era rechazado.
 */
export function normalizarMontoTexto(texto: string): string | null {
  const limpio = texto.trim();
  if (limpio === "") return null;

  if (limpio.includes(",")) {
    const partes = limpio.split(",");
    if (partes.length !== 2) return null;

    const enteros = partes[0].replace(/\./g, "");
    const decimales = partes[1];

    return /^\d+$/.test(enteros) && /^\d{1,2}$/.test(decimales)
      ? `${enteros}.${decimales}`
      : null;
  }

  const puntos = limpio.split(".").length - 1;

  if (puntos === 0) {
    return /^\d+$/.test(limpio) ? limpio : null;
  }

  if (puntos > 1) {
    const sinPuntos = limpio.replace(/\./g, "");
    return /^\d+$/.test(sinPuntos) ? sinPuntos : null;
  }

  const [enteros, resto] = limpio.split(".");
  if (!/^\d+$/.test(enteros) || !/^\d+$/.test(resto)) return null;

  if (resto.length === 3) return enteros + resto;
  if (resto.length <= 2) return `${enteros}.${resto}`;

  return null;
}

/** Cantidad de decimales que admite un porcentaje de descuento. */
const DECIMALES_PORCENTAJE = 2;

/** "12,5" → "12.5". Mismo criterio que los montos, sin separador de miles. */
export function normalizarPorcentajeTexto(texto: string): string | null {
  const canonico = texto.trim().replace(",", ".");
  if (canonico === "") return null;

  return new RegExp(`^\\d+(\\.\\d{1,${DECIMALES_PORCENTAJE}})?$`).test(canonico)
    ? canonico
    : null;
}

/**
 * Convierte un decimal canónico a entero escalado.
 * "1234.5" con escala 2 → 123450n.
 */
export function aEnteroEscalado(canonico: string, escala: number): bigint {
  const [enteros, decimales = ""] = canonico.split(".");
  const relleno = decimales.padEnd(escala, "0").slice(0, escala);

  return BigInt(enteros + relleno);
}

/** Inversa de `aEnteroEscalado`: 123450n con escala 2 → "1234.50". */
export function deEnteroEscalado(valor: bigint, escala: number): string {
  const negativo = valor < 0n;
  const digitos = (negativo ? -valor : valor).toString().padStart(escala + 1, "0");
  const corte = digitos.length - escala;

  return `${negativo ? "-" : ""}${digitos.slice(0, corte)}.${digitos.slice(corte)}`;
}

/** Formato argentino para mostrar, a partir de un canónico. */
export function formatearCanonico(canonico: string): string {
  const [enteros, decimales = "00"] = canonico.split(".");
  const conMiles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `$ ${conMiles},${decimales.padEnd(2, "0")}`;
}
