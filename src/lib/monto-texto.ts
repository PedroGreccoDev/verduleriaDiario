/**
 * Traducción entre lo que tipea el operador y un número canónico.
 *
 * Módulo puro, SIN dependencias: lo usan tanto las Server Actions como los
 * componentes del navegador. Que sea el mismo código de los dos lados no es
 * prolijidad — es lo que garantiza que el monto que la pantalla muestra para
 * confirmar sea exactamente el que se va a guardar.
 */

/**
 * Normaliza un monto escrito a la argentina: punto de miles y nada más.
 * "128.450" → "128450". Acepta también "128450" tal cual.
 *
 * Devuelve `null` si no es un monto válido, para que quien llama decida el error.
 *
 * **Los centavos se rechazan, no se truncan.** Una coma —o un punto seguido de uno
 * o dos dígitos, que es un decimal disfrazado— hace que la función devuelva `null`
 * y el operador vea un error. Truncar en silencio sería peor: quien tipeó "45,50"
 * quiso decir algo, y guardarle $45 sin avisar es cambiarle el monto por la
 * espalda. Que la moneda no tenga centavos (AGENTS.md) no significa que tipearlos
 * sea inofensivo.
 *
 * El punto solo vale como separador de miles y en grupos exactos de tres, así que
 * "1.000" es mil sin ambigüedad posible. Sin decimales en juego, la lectura de
 * "45.50" ya no compite con nada: es simplemente un monto mal escrito.
 */
export function normalizarMontoTexto(texto: string): string | null {
  const limpio = texto.trim();
  if (limpio === "") return null;

  if (limpio.includes(",")) return null;

  if (/^\d+$/.test(limpio)) return limpio;

  return /^\d{1,3}(\.\d{3})+$/.test(limpio) ? limpio.replace(/\./g, "") : null;
}

/**
 * Cantidad de decimales que admite un porcentaje de descuento.
 *
 * El porcentaje SÍ los lleva: "12,5 %" es un descuento que las financieras usan
 * todo el tiempo. Lo que no tiene decimales es el peso, que es el resultado.
 */
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
  // Con escala 0 no hay parte decimal que separar, y el camino de abajo dejaría un
  // punto colgando al final ("1234.").
  if (escala === 0) return valor.toString();

  const negativo = valor < 0n;
  const digitos = (negativo ? -valor : valor).toString().padStart(escala + 1, "0");
  const corte = digitos.length - escala;

  return `${negativo ? "-" : ""}${digitos.slice(0, corte)}.${digitos.slice(corte)}`;
}

/** Formato argentino para mostrar, a partir de un canónico: "$ 4.070.000". */
export function formatearCanonico(canonico: string): string {
  // Se descarta cualquier parte decimal en vez de redondearla: acá ya no debería
  // venir ninguna, y si viene, el error está aguas arriba y hay que verlo ahí.
  const [enteros] = canonico.split(".");
  const conMiles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `$ ${conMiles}`;
}
