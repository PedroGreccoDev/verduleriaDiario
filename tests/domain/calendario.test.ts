import { describe, expect, it } from "vitest";
import { proximoTurnoSugerido, turnosSugeridos } from "@/domain/caja/calendario";

/**
 * Turnos por día: dos de lunes a sábado, uno los domingos y feriados.
 * Es una sugerencia, no una restricción — estos tests verifican qué propone,
 * no qué prohíbe, porque no prohíbe nada.
 *
 * Las fechas se construyen con `new Date(año, mes, día)`, que interpreta en hora
 * local: es el día de la semana de la verdulería, no el de UTC.
 */

describe("turnos sugeridos", () => {
  it("de lunes a sábado propone mañana y tarde", () => {
    // 10 al 15 de agosto de 2026: lunes a sábado.
    for (const dia of [10, 11, 12, 13, 14, 15]) {
      expect(turnosSugeridos(new Date(2026, 7, dia))).toEqual(["mañana", "tarde"]);
    }
  });

  it("el domingo propone un solo turno", () => {
    // 9 y 16 de agosto de 2026 son domingos.
    expect(turnosSugeridos(new Date(2026, 7, 9))).toEqual(["único"]);
    expect(turnosSugeridos(new Date(2026, 7, 16))).toEqual(["único"]);
  });

  it("un domingo a la noche sigue siendo domingo", () => {
    // 23:30 local es lunes en UTC. Tiene que seguir proponiendo el turno único.
    expect(turnosSugeridos(new Date(2026, 7, 9, 23, 30))).toEqual(["único"]);
  });
});

describe("próximo turno sugerido", () => {
  const lunes = new Date(2026, 7, 10);
  const domingo = new Date(2026, 7, 9);

  it("sin turnos abiertos, propone el primero del día", () => {
    expect(proximoTurnoSugerido(lunes, [])).toBe("mañana");
    expect(proximoTurnoSugerido(domingo, [])).toBe("único");
  });

  it("con la mañana ya hecha, propone la tarde", () => {
    expect(proximoTurnoSugerido(lunes, ["mañana"])).toBe("tarde");
  });

  it("no propone nada cuando ya se hicieron todos", () => {
    expect(proximoTurnoSugerido(lunes, ["mañana", "tarde"])).toBeNull();
    expect(proximoTurnoSugerido(domingo, ["único"])).toBeNull();
  });

  it("un feriado se resuelve solo: se abre uno y no propone más", () => {
    // El sistema no sabe que es feriado. Propone "mañana", el operador abre ese
    // turno y al cerrarlo la pantalla propone "tarde" — que simplemente no se abre.
    // Nada se rompe y no hace falta mantener un calendario de feriados.
    expect(proximoTurnoSugerido(lunes, ["mañana"])).toBe("tarde");
  });
});
