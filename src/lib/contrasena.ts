import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hash de contraseñas con scrypt, del `node:crypto` que ya viene en Node.
 *
 * POR QUÉ NO bcrypt NI argon2: los dos son módulos nativos, y esto se va a
 * empaquetar en un instalador de escritorio. Un binario compilado hay que
 * recompilarlo para la versión de Node del empaquetador y volver a hacerlo cada
 * vez que el empaquetador cambia; scrypt es parte de Node y no se rompe nunca.
 * Como KDF está a la altura: es la que recomienda el RFC 7914 para este uso y
 * resiste el mismo tipo de ataque por hardware que argon2.
 *
 * NADA en este archivo puede terminar del lado del cliente: se importa solo desde
 * servicios de dominio, que corren en el servidor.
 */

/**
 * `promisify(scrypt)` no sirve acá: pierde la sobrecarga que acepta opciones y
 * deja de tipar el cuarto argumento, que es justamente donde van N, r y p.
 */
function derivar(
  contrasena: string,
  sal: Buffer,
  largo: number,
  opciones: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(contrasena, sal, largo, opciones, (error, derivada) => {
      if (error) rechazar(error);
      else resolver(derivada);
    });
  });
}

/**
 * Costo de derivación. 2^15 iteraciones tarda alrededor de 100 ms en una PC de
 * mostrador: imperceptible cuando alguien entra una vez por turno, y caro para
 * quien se llevó la base y quiere probar millones de contraseñas.
 *
 * Los tres van adentro del hash, así que subirlos más adelante no invalida las
 * contraseñas ya guardadas: las viejas se siguen verificando con su propio costo.
 */
const COSTO = 32_768; // N
const BLOQUE = 8; // r
const PARALELISMO = 1; // p
const LARGO_CLAVE = 64;
const LARGO_SAL = 16;

/**
 * scrypt con N alto necesita más memoria de la que Node concede por defecto
 * (32 MB): 128 × N × r = 32 MB justos, y el límite es estricto, no "hasta".
 */
const MEMORIA_MAXIMA = 64 * 1024 * 1024;

/** Formato guardado: `scrypt$N$r$p$sal$hash`, las dos últimas en base64. */
export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(LARGO_SAL);
  const derivada = await derivar(contrasena.normalize("NFKC"), sal, LARGO_CLAVE, {
    N: COSTO,
    r: BLOQUE,
    p: PARALELISMO,
    maxmem: MEMORIA_MAXIMA,
  });

  return [
    "scrypt",
    COSTO,
    BLOQUE,
    PARALELISMO,
    sal.toString("base64"),
    derivada.toString("base64"),
  ].join("$");
}

/**
 * Verifica una contraseña contra el hash guardado.
 *
 * Los parámetros salen del hash, no de las constantes de arriba: un hash creado
 * con un costo menor tiene que seguir verificándose después de subirlo.
 *
 * Devuelve `false` ante un hash ilegible en vez de tirar excepción. Un hash roto
 * en la base es un usuario que no puede entrar —y que el admin tiene que
 * restablecer—, no una pantalla de error.
 */
export async function verificarContrasena(
  contrasena: string,
  hashGuardado: string,
): Promise<boolean> {
  const partes = hashGuardado.split("$");

  if (partes.length !== 6 || partes[0] !== "scrypt") return false;

  const [, costo, bloque, paralelismo, salBase64, hashBase64] = partes;
  const sal = Buffer.from(salBase64, "base64");
  const esperado = Buffer.from(hashBase64, "base64");

  if (sal.length === 0 || esperado.length === 0) return false;

  let derivada: Buffer;
  try {
    derivada = await derivar(contrasena.normalize("NFKC"), sal, esperado.length, {
      N: Number(costo),
      r: Number(bloque),
      p: Number(paralelismo),
      maxmem: MEMORIA_MAXIMA,
    });
  } catch {
    return false;
  }

  // Comparación de tiempo constante: un `===` corta en el primer byte distinto y
  // filtra, en el tiempo de respuesta, cuánto del hash se acertó.
  return timingSafeEqual(derivada, esperado);
}

/**
 * Reglas de la contraseña.
 *
 * A propósito son pocas: un mínimo de largo y nada más. Exigir mayúscula, número
 * y símbolo en un local donde la clave se elige una vez y se comparte de palabra
 * termina en un papelito pegado al monitor, que es peor que una contraseña larga
 * y simple. El largo es lo único que aporta de verdad contra la fuerza bruta.
 */
export const LARGO_MINIMO_CONTRASENA = 8;

/** Devuelve el problema si lo hay, o `null` si la contraseña sirve. */
export function validarContrasena(contrasena: string): string | null {
  if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
    return `La contraseña necesita al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;
  }

  // Una contraseña que es toda espacios pasa el largo y no la puede tipear nadie.
  if (contrasena.trim().length === 0) {
    return "La contraseña no puede ser solo espacios.";
  }

  return null;
}
