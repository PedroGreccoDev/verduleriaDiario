import { describe, expect, it } from "vitest";
import {
  periodoDe,
  periodoPersonalizado,
  ultimoDiaIncluido,
} from "@/domain/caja/periodo";

/** §5.1: los rangos de fecha del reporte. Módulo puro, sin base. */

/** "2026-08-14 00:00" local, que es como se ven los cortes de período. */
function local(fecha: Date): string {
  const dosDigitos = (n: number) => String(n).padStart(2, "0");

  return (
    `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())} ` +
    `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`
  );
}

describe("día", () => {
  it("va de medianoche a medianoche del día siguiente", () => {
    // El corte superior es exclusivo a propósito: un retiro del turno tarde a las
    // 21:30 tiene que entrar en el reporte de ese día, no en el del siguiente ni
    // en ninguno.
    const periodo = periodoDe("dia", new Date(2026, 7, 14, 21, 30));

    expect(local(periodo.desde)).toBe("2026-08-14 00:00");
    expect(local(periodo.hasta)).toBe("2026-08-15 00:00");
  });
});

describe("semana", () => {
  it("arranca el lunes", () => {
    const periodo = periodoDe("semana", new Date(2026, 7, 12, 10, 0)); // miércoles

    expect(local(periodo.desde)).toBe("2026-08-10 00:00"); // lunes
    expect(local(periodo.hasta)).toBe("2026-08-17 00:00"); // lunes siguiente
  });

  it("el domingo cierra la semana que arrancó el lunes anterior", () => {
    // getDay() da 0 para el domingo. Sin corregirlo, el domingo abriría una semana
    // nueva y el día de más venta quedaría separado del resto.
    const periodo = periodoDe("semana", new Date(2026, 7, 16, 10, 0)); // domingo

    expect(local(periodo.desde)).toBe("2026-08-10 00:00");
    expect(local(periodo.hasta)).toBe("2026-08-17 00:00");
  });
});

describe("mes y año", () => {
  it("el mes incluye su último día completo", () => {
    const periodo = periodoDe("mes", new Date(2026, 7, 14));

    expect(local(periodo.desde)).toBe("2026-08-01 00:00");
    expect(local(periodo.hasta)).toBe("2026-09-01 00:00");
  });

  it("diciembre cierra en enero del año siguiente", () => {
    const periodo = periodoDe("mes", new Date(2026, 11, 5));

    expect(local(periodo.hasta)).toBe("2027-01-01 00:00");
  });

  it("el año va del 1 de enero al 1 de enero siguiente", () => {
    const periodo = periodoDe("anio", new Date(2026, 7, 14));

    expect(local(periodo.desde)).toBe("2026-01-01 00:00");
    expect(local(periodo.hasta)).toBe("2027-01-01 00:00");
  });
});

describe("personalizado", () => {
  it("incluye entero el día del hasta", () => {
    const periodo = periodoPersonalizado("2026-08-01", "2026-08-14");

    expect(periodo).not.toBeNull();
    expect(local(periodo!.desde)).toBe("2026-08-01 00:00");
    expect(local(periodo!.hasta)).toBe("2026-08-15 00:00");
  });

  it("un solo día es un rango válido", () => {
    const periodo = periodoPersonalizado("2026-08-14", "2026-08-14");

    expect(local(periodo!.hasta)).toBe("2026-08-15 00:00");
  });

  it("rechaza el rango dado vuelta en vez de corregirlo", () => {
    // Darlo vuelta en silencio devolvería un reporte que nadie pidió. Quien escribió
    // las fechas al revés quiso decir otra cosa y tiene que enterarse.
    expect(periodoPersonalizado("2026-08-14", "2026-08-01")).toBeNull();
  });

  it("rechaza una fecha que no existe", () => {
    // El 31 de febrero construye un Date válido que cae en marzo. Sin verificarlo,
    // el reporte arrancaría un mes después de lo pedido.
    expect(periodoPersonalizado("2026-02-31", "2026-03-05")).toBeNull();
    expect(periodoPersonalizado("14/08/2026", "2026-08-15")).toBeNull();
  });
});

describe("último día incluido", () => {
  it("es el anterior al corte, que es exclusivo", () => {
    const periodo = periodoDe("mes", new Date(2026, 7, 14));

    expect(local(ultimoDiaIncluido(periodo))).toBe("2026-08-31 00:00");
  });
});
