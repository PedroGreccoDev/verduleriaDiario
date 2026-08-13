import { describe, expect, it } from "vitest";
import { dec } from "@/lib/decimal";
import { calcularCheque } from "@/domain/cheques/calculo";
import { previsualizarDesdeTexto } from "@/domain/cheques/calculo-puro";
import { formatearCanonico, normalizarMontoTexto } from "@/lib/monto-texto";

/**
 * El preview de la pantalla de compra y el guardado del servidor tienen que dar
 * SIEMPRE lo mismo. §4.2 hace que el operador confirme mirando ese número: si
 * difirieran aunque sea en un centavo, la pantalla que existe para verificar
 * estaría mintiendo.
 *
 * Comparten implementación (`calculo-puro`), y estos tests son el candado que
 * impide que alguien las separe más adelante sin darse cuenta.
 */

describe("preview y guardado coinciden", () => {
  const casos = [
    { nominal: "1000", pct: "10" },
    { nominal: "1200000", pct: "11.5" },
    { nominal: "847532.19", pct: "7.35" },
    { nominal: "333333.33", pct: "3.33" },
    { nominal: "999999.99", pct: "0.01" },
    { nominal: "1", pct: "99.99" },
    { nominal: "0.03", pct: "50" },
    { nominal: "12345678901.23", pct: "13.57" },
  ];

  for (const { nominal, pct } of casos) {
    it(`nominal ${nominal} al ${pct} %`, () => {
      const servidor = calcularCheque(dec(nominal), dec(pct));
      const pantalla = previsualizarDesdeTexto(nominal, pct);

      expect(pantalla.ok).toBe(true);
      expect(pantalla.montoPagado).toBe(servidor.montoPagado.toFixed(2));
      expect(pantalla.ahorro).toBe(servidor.ahorro.toFixed(2));
    });
  }

  it("el ahorro más lo pagado da siempre el nominal exacto", () => {
    for (const { nominal, pct } of casos) {
      const { montoPagado, ahorro } = calcularCheque(dec(nominal), dec(pct));

      expect(montoPagado.plus(ahorro).toFixed(2)).toBe(dec(nominal).toFixed(2));
    }
  });

  it("el ejemplo del dueño: 1000 al 10 % son 900 pagados y 100 de ahorro", () => {
    const vista = previsualizarDesdeTexto("1000", "10");

    expect(formatearCanonico(vista.montoPagado!)).toBe("$ 900,00");
    expect(formatearCanonico(vista.ahorro!)).toBe("$ 100,00");
  });

  it("un monto grande no pierde precisión", () => {
    // Con `number`, nominal × 10000 supera el entero seguro de JavaScript.
    // Por eso el cálculo va en BigInt.
    const vista = previsualizarDesdeTexto("99999999999.99", "50");

    expect(vista.montoPagado).toBe("50000000000.00");
    expect(vista.ahorro).toBe("49999999999.99");
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
});

describe("montos escritos a la argentina", () => {
  it("acepta punto de miles y coma decimal", () => {
    expect(normalizarMontoTexto("128.450,75")).toBe("128450.75");
    expect(normalizarMontoTexto("1.000.000")).toBe("1000000");
    expect(normalizarMontoTexto("45000,5")).toBe("45000.5");
  });

  it("acepta también el formato con punto decimal", () => {
    expect(normalizarMontoTexto("128450.75")).toBe("128450.75");
  });

  it("resuelve el punto solo por la cantidad de dígitos que le siguen", () => {
    // Tres dígitos: separador de miles, que es como se escribe acá.
    expect(normalizarMontoTexto("1.000")).toBe("1000");
    expect(normalizarMontoTexto("980.000")).toBe("980000");

    // Uno o dos: separador decimal.
    expect(normalizarMontoTexto("45.50")).toBe("45.50");
    expect(normalizarMontoTexto("45.5")).toBe("45.5");
  });

  it("rechaza lo que no es un monto", () => {
    expect(normalizarMontoTexto("45ooo")).toBeNull();
    expect(normalizarMontoTexto("")).toBeNull();
    expect(normalizarMontoTexto("-500")).toBeNull();
    // Más de dos decimales: son centavos que no se pueden guardar.
    expect(normalizarMontoTexto("100,123")).toBeNull();
  });

  it("formatea de vuelta al formato argentino", () => {
    expect(formatearCanonico("1234567.8")).toBe("$ 1.234.567,80");
    expect(formatearCanonico("0.5")).toBe("$ 0,50");
  });
});
