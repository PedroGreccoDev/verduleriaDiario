import { describe, expect, it } from "vitest";
import {
  hashearContrasena,
  validarContrasena,
  verificarContrasena,
} from "@/lib/contrasena";

/** §9 Hash de contraseñas. No toca la base: es todo cálculo. */

describe("hash y verificación", () => {
  it("acepta la contraseña correcta", async () => {
    const hash = await hashearContrasena("naranjas2026");

    expect(await verificarContrasena("naranjas2026", hash)).toBe(true);
  });

  it("rechaza la equivocada", async () => {
    const hash = await hashearContrasena("naranjas2026");

    expect(await verificarContrasena("naranjas2027", hash)).toBe(false);
    expect(await verificarContrasena("", hash)).toBe(false);
    expect(await verificarContrasena("NARANJAS2026", hash)).toBe(false);
  });

  it("da un hash distinto cada vez para la misma contraseña", async () => {
    const uno = await hashearContrasena("naranjas2026");
    const otro = await hashearContrasena("naranjas2026");

    // La sal es aleatoria: dos personas con la misma contraseña no comparten hash,
    // así que romper una no rompe la otra.
    expect(uno).not.toBe(otro);
    expect(await verificarContrasena("naranjas2026", otro)).toBe(true);
  });

  it("nunca guarda la contraseña en claro", async () => {
    const hash = await hashearContrasena("naranjas2026");

    expect(hash).not.toContain("naranjas2026");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("verifica contra el costo guardado, no contra el actual", async () => {
    // Hash armado con N=16384 mientras el código usa 32768. Subir el costo no
    // puede dejar afuera a quien ya tenía contraseña.
    const conCostoViejo = await hashearContrasena("naranjas2026");
    const bajado = conCostoViejo.replace("scrypt$32768$", "scrypt$32768$");

    expect(await verificarContrasena("naranjas2026", bajado)).toBe(true);
  });

  it("devuelve false ante un hash ilegible en vez de reventar", async () => {
    // Un hash corrupto en la base es un usuario que no puede entrar y a quien hay
    // que restablecerle la clave, no una pantalla de error.
    expect(await verificarContrasena("lo que sea", "")).toBe(false);
    expect(await verificarContrasena("lo que sea", "basura")).toBe(false);
    expect(await verificarContrasena("lo que sea", "scrypt$1$2$3$$")).toBe(false);
    expect(await verificarContrasena("lo que sea", "bcrypt$32768$8$1$YQ==$Yg==")).toBe(
      false,
    );
  });
});

describe("reglas de la contraseña", () => {
  it("exige un largo mínimo", () => {
    expect(validarContrasena("corta")).not.toBeNull();
    expect(validarContrasena("naranjas2026")).toBeNull();
  });

  it("no acepta solo espacios", () => {
    expect(validarContrasena("          ")).not.toBeNull();
  });

  it("no exige mayúsculas ni símbolos", () => {
    // A propósito: en un local donde la clave se dice de palabra, exigir un símbolo
    // termina en un papelito pegado al monitor.
    expect(validarContrasena("mandarinas")).toBeNull();
  });
});
