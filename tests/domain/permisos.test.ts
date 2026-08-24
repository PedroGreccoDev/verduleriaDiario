import { describe, expect, it } from "vitest";
import {
  normalizarPermisos,
  PERMISOS,
  PLANTILLAS_ROL,
  esPermisoValido,
  etiquetaPermiso,
  PERMISO_ADMINISTRAR,
  rolesVisiblesPara,
  permisosOtorgablesPor,
  puedeVerCuentaConRol,
} from "@/domain/usuarios/permisos";

/** §9 Catálogo de permisos. Cálculo puro, sin base. */

describe("normalización", () => {
  it("cargar implica ver", () => {
    // Cargar sin poder ver no significa nada: la persona no llega a la pantalla
    // donde estaría el botón.
    expect(normalizarPermisos(["caja.cargar"])).toEqual(["caja.ver", "caja.cargar"]);
  });

  it("anular también implica ver", () => {
    expect(normalizarPermisos(["clientes.anular"])).toEqual([
      "clientes.ver",
      "clientes.anular",
    ]);
  });

  it("descarta permisos que no existen", () => {
    // Una fila suelta en la base con un permiso inventado no habilita nada.
    expect(normalizarPermisos(["caja.volar", "inventado", "caja.ver"])).toEqual([
      "caja.ver",
    ]);
  });

  it("no duplica", () => {
    expect(normalizarPermisos(["caja.ver", "caja.ver", "caja.cargar"])).toEqual([
      "caja.ver",
      "caja.cargar",
    ]);
  });

  it("devuelve siempre el mismo orden, venga como venga", () => {
    const unOrden = normalizarPermisos(["reportes.ver", "caja.cargar", "caja.ver"]);
    const otroOrden = normalizarPermisos(["caja.ver", "reportes.ver", "caja.cargar"]);

    expect(unOrden).toEqual(otroOrden);
  });

  it("una lista vacía deja sin nada", () => {
    expect(normalizarPermisos([])).toEqual([]);
  });
});

describe("plantillas de rol", () => {
  it("el administrador puede todo", () => {
    expect(PLANTILLAS_ROL.admin).toEqual(PERMISOS);
  });

  it("el dueño puede todo salvo administrar", () => {
    // Es la única diferencia entre los dos, y la que sostiene el resto: sin
    // `usuarios.administrar` el dueño no borra cuentas y no ve las de admin.
    expect(PLANTILLAS_ROL.dueno).not.toContain(PERMISO_ADMINISTRAR);
    expect(PLANTILLAS_ROL.dueno).toContain("usuarios.configurar");
    expect(PLANTILLAS_ROL.dueno).toEqual(
      PERMISOS.filter((permiso) => permiso !== PERMISO_ADMINISTRAR),
    );
  });

  it("el empleado no anula nada", () => {
    const anulaciones = PLANTILLAS_ROL.empleado.filter((p) => p.endsWith(".anular"));

    expect(anulaciones).toEqual([]);
  });

  it("el empleado no ve los números del negocio ni configura usuarios", () => {
    expect(PLANTILLAS_ROL.empleado).not.toContain("reportes.ver");
    expect(PLANTILLAS_ROL.empleado).not.toContain("usuarios.configurar");
  });

  it("el empleado carga caja y fiado", () => {
    expect(PLANTILLAS_ROL.empleado).toContain("caja.cargar");
    expect(PLANTILLAS_ROL.empleado).toContain("clientes.cargar");
    // Y las de ver que arrastran, por la regla de normalización.
    expect(PLANTILLAS_ROL.empleado).toContain("caja.ver");
  });
});

describe("catálogo", () => {
  it("reportes solo se mira", () => {
    expect(esPermisoValido("reportes.ver")).toBe(true);
    expect(esPermisoValido("reportes.cargar")).toBe(false);
    expect(esPermisoValido("reportes.anular")).toBe(false);
  });

  it("traduce a algo que se pueda leer en un mensaje de error", () => {
    expect(etiquetaPermiso("caja.anular")).toBe("Anular caja");
    expect(etiquetaPermiso("usuarios.configurar")).toBe("Configurar usuarios");
  });
});

/** §9: qué ve y qué puede otorgar cada quien. */
describe("visibilidad del rol de administrador", () => {
  it("el dueño no ve el rol admin entre los que puede elegir", () => {
    expect(rolesVisiblesPara(PLANTILLAS_ROL.dueno)).toEqual(["dueno", "empleado"]);
  });

  it("el administrador los ve a todos", () => {
    expect(rolesVisiblesPara(PLANTILLAS_ROL.admin)).toContain("admin");
  });

  it("el dueño no puede otorgar el permiso de administración", () => {
    expect(permisosOtorgablesPor(PLANTILLAS_ROL.dueno)).not.toContain(PERMISO_ADMINISTRAR);
    expect(permisosOtorgablesPor(PLANTILLAS_ROL.admin)).toContain(PERMISO_ADMINISTRAR);
  });

  it("el dueño no puede ver una cuenta de administrador, pero sí el resto", () => {
    expect(puedeVerCuentaConRol(PLANTILLAS_ROL.dueno, "admin")).toBe(false);
    expect(puedeVerCuentaConRol(PLANTILLAS_ROL.dueno, "dueno")).toBe(true);
    expect(puedeVerCuentaConRol(PLANTILLAS_ROL.dueno, "empleado")).toBe(true);
  });

  it("un empleado tampoco ve las cuentas de administrador", () => {
    // No es que el permiso lo tenga cualquiera menos el dueño: lo tiene solo quien
    // tiene `usuarios.administrar`.
    expect(puedeVerCuentaConRol(PLANTILLAS_ROL.empleado, "admin")).toBe(false);
  });
});
