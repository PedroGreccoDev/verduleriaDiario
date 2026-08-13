import { describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import { calcularCheque } from "@/domain/cheques/calculo";
import { previsualizarDesdeTexto } from "@/domain/cheques/calculo-puro";
import { formatearCanonico, normalizarMontoTexto } from "@/lib/monto-texto";

/**
 * El preview de la pantalla de compra y el guardado del servidor tienen que dar
 * SIEMPRE lo mismo. §4.2 hace que el operador confirme mirando ese número: si
 * difirieran aunque sea en un peso, la pantalla que existe para verificar estaría
 * mintiendo.
 *
 * Comparten implementación (`calculo-puro`), y estos tests son el candado que
 * impide que alguien las separe más adelante sin darse cuenta.
 */

describe("preview y guardado coinciden", () => {
  const casos = [
    { nominal: "1000", pct: "10" },
    { nominal: "1200000", pct: "11.5" },
    { nominal: "847532", pct: "7.35" },
    { nominal: "333333", pct: "3.33" },
    { nominal: "999999", pct: "0.01" },
    // El descuento más grande que todavía deja pagar $1: 10000 × 0,01 %.
    { nominal: "10000", pct: "99.99" },
    { nominal: "12345678901", pct: "13.57" },
  ];

  for (const { nominal, pct } of casos) {
    it(`nominal ${nominal} al ${pct} %`, () => {
      const servidor = calcularCheque(dec(nominal), dec(pct));
      const pantalla = previsualizarDesdeTexto(nominal, pct);

      expect(pantalla.ok).toBe(true);
      expect(pantalla.montoPagado).toBe(servidor.montoPagado.toFixed(0));
      expect(pantalla.ahorro).toBe(servidor.ahorro.toFixed(0));
    });
  }

  it("el ahorro más lo pagado da siempre el nominal exacto", () => {
    for (const { nominal, pct } of casos) {
      const { montoPagado, ahorro } = calcularCheque(dec(nominal), dec(pct));

      expect(montoPagado.plus(ahorro).toFixed(0)).toBe(dec(nominal).toFixed(0));
    }
  });

  it("el ejemplo del dueño: 1000 al 10 % son 900 pagados y 100 de ahorro", () => {
    const vista = previsualizarDesdeTexto("1000", "10");

    expect(formatearCanonico(vista.montoPagado!)).toBe("$ 900");
    expect(formatearCanonico(vista.ahorro!)).toBe("$ 100");
  });

  it("un monto grande no pierde precisión", () => {
    // Con `number`, nominal × 10000 supera el entero seguro de JavaScript.
    // Por eso el cálculo va en BigInt.
    const vista = previsualizarDesdeTexto("99999999999", "50");

    expect(vista.montoPagado).toBe("49999999999");
    expect(vista.ahorro).toBe("50000000000");
  });
});

/**
 * El resto que deja el porcentaje va SIEMPRE a favor de la verdulería, que es la
 * que pone la plata: paga de menos, nunca de más (AGENTS.md).
 */
describe("el peso que sobra queda a favor de la verdulería", () => {
  it("1000 al 3,33 % se paga 966, no 967", () => {
    // La cuenta exacta da 966,7. Redondear al más cercano daría 967 y la
    // verdulería estaría pagando 30 centavos de más por cada cheque así.
    const { montoPagado, ahorro } = calcularCheque(dec("1000"), dec("3.33"));

    expect(montoPagado.toFixed(0)).toBe("966");
    expect(ahorro.toFixed(0)).toBe("34");
  });

  it("nunca paga más que la cuenta exacta", () => {
    const casos = [
      { nominal: "1000", pct: "3.33" },
      { nominal: "777", pct: "12.5" },
      { nominal: "10001", pct: "33.33" },
      { nominal: "999", pct: "0.01" },
    ];

    for (const { nominal, pct } of casos) {
      const { montoPagado } = calcularCheque(dec(nominal), dec(pct));
      const exacto = dec(nominal).mul(dec(100).minus(dec(pct))).div(100);

      expect(montoPagado.lessThanOrEqualTo(exacto)).toBe(true);
      // Y no se va más de un peso: es piso, no cualquier cosa hacia abajo.
      expect(exacto.minus(montoPagado).lessThan(1)).toBe(true);
    }
  });

  it("el ahorro absorbe el resto, así las columnas del reporte cierran", () => {
    const { nominal, montoPagado, ahorro } = calcularCheque(dec("777"), dec("12.5"));

    expect(montoPagado.plus(ahorro).equals(nominal)).toBe(true);
  });
});

describe("previsualización con entradas incompletas", () => {
  it("no calcula si falta el nominal o el porcentaje", () => {
    expect(previsualizarDesdeTexto("", "10").ok).toBe(false);
    expect(previsualizarDesdeTexto("1000", "").ok).toBe(false);
  });

  it("rechaza 100 % de descuento", () => {
    expect(previsualizarDesdeTexto("1000", "100").ok).toBe(false);
  });

  it("rechaza nominal cero", () => {
    expect(previsualizarDesdeTexto("0", "10").ok).toBe(false);
  });

  it("rechaza la compra que no llega a pagar ni un peso", () => {
    // $10 al 95 % son $0,50, que con el piso queda en $0. Un cheque que no se
    // pagó no es una compra.
    expect(previsualizarDesdeTexto("10", "95").ok).toBe(false);
    expect(() => calcularCheque(dec("10"), dec("95"))).toThrow(/menos de \$1/);
  });

  it("rechaza un nominal con centavos en vez de truncarlo", () => {
    expect(previsualizarDesdeTexto("1000,50", "10").ok).toBe(false);
    expect(() => calcularCheque(dec("1000.50"), dec("10"))).toThrow(/sin centavos/);
  });
});

describe("montos escritos a la argentina, en pesos enteros", () => {
  it("acepta punto de miles", () => {
    expect(normalizarMontoTexto("1.000.000")).toBe("1000000");
    expect(normalizarMontoTexto("980.000")).toBe("980000");
    expect(normalizarMontoTexto("1.000")).toBe("1000");
  });

  it("acepta el monto pelado, sin separadores", () => {
    expect(normalizarMontoTexto("128450")).toBe("128450");
    expect(normalizarMontoTexto("0")).toBe("0");
  });

  it("rechaza los centavos en lugar de truncarlos", () => {
    // Quien escribió esto quiso decir algo; guardarle otro monto sin avisar sería
    // cambiárselo por la espalda.
    expect(normalizarMontoTexto("128.450,75")).toBeNull();
    expect(normalizarMontoTexto("45000,5")).toBeNull();
    expect(normalizarMontoTexto("128450.75")).toBeNull();
    expect(normalizarMontoTexto("45.50")).toBeNull();
  });

  it("rechaza lo que no es un monto", () => {
    expect(normalizarMontoTexto("45ooo")).toBeNull();
    expect(normalizarMontoTexto("")).toBeNull();
    expect(normalizarMontoTexto("-500")).toBeNull();
    // Grupos de miles mal armados.
    expect(normalizarMontoTexto("1.0000")).toBeNull();
    expect(normalizarMontoTexto("12.34.567")).toBeNull();
  });

  it("formatea de vuelta al formato argentino, sin centavos", () => {
    expect(formatearCanonico("1234567")).toBe("$ 1.234.567");
    expect(formatearCanonico("900")).toBe("$ 900");
    expect(formatearCanonico("0")).toBe("$ 0");
  });
});
