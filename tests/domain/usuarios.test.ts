import { describe, expect, it } from "vitest";
import type { ErrorDominio } from "@/lib/errores";
import {
  actualizarPermisos,
  borrarUsuario,
  cambiarActivacion,
  cambiarContrasenaPropia,
  crearPrimerAdministrador,
  crearUsuario,
  haySistemaInicializado,
  editarUsuario,
  listarUsuarios,
  obtenerUsuario,
  restablecerContrasena,
  verificarCredenciales,
} from "@/domain/usuarios/usuario.service";
import { PERMISOS, PLANTILLAS_ROL, PERMISO_ADMINISTRAR } from "@/domain/usuarios/permisos";
import {
  abrirSesion,
  cerrarSesion,
  sesionesDe,
  usuarioDeSesion,
} from "@/domain/usuarios/sesion.service";
import { prisma } from "../setup";

/** §9 Usuarios, permisos y sesiones. */

/** Los permisos de quien ejecuta la operación. La mayoría de los casos son un admin. */
const COMO_ADMIN = PERMISOS;
const COMO_DUENO = PLANTILLAS_ROL.dueno;

async function codigoDelError(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    return (error as ErrorDominio).codigo;
  }
  throw new Error("Se esperaba un error de dominio y no hubo ninguno.");
}

async function crearAdmin(usuario = "rami") {
  return crearUsuario({
    nombre: "Rami Vélez",
    usuario,
    contrasena: "naranjas2026",
    rol: "admin",
  });
}

describe("alta de usuarios", () => {
  it("crea con los permisos de la plantilla del rol", async () => {
    const empleado = await crearUsuario({
      nombre: "Marcela Gómez",
      usuario: "marcela",
      contrasena: "mandarinas",
      rol: "empleado",
    });

    expect(empleado.permisos).toContain("caja.cargar");
    expect(empleado.permisos).not.toContain("caja.anular");
  });

  it("los permisos explícitos le ganan a la plantilla", async () => {
    // Es lo que hace la pantalla: manda los checkboxes como quedaron, que puede no
    // coincidir con ninguna plantilla.
    const empleado = await crearUsuario({
      nombre: "Marcela Gómez",
      usuario: "marcela",
      contrasena: "mandarinas",
      rol: "empleado",
      permisos: ["caja.ver", "reportes.ver"],
    });

    expect(empleado.permisos).toEqual(["caja.ver", "reportes.ver"]);
  });

  it("normaliza el nombre de ingreso", async () => {
    const creado = await crearUsuario({
      nombre: "Marcela Gómez",
      usuario: "  MARCELA  ",
      contrasena: "mandarinas",
      rol: "empleado",
    });

    expect(creado.usuario).toBe("marcela");
  });

  it("no deja dos personas con el mismo nombre de ingreso", async () => {
    await crearAdmin("marcela");

    const codigo = await codigoDelError(() =>
      crearUsuario({
        nombre: "Otra Marcela",
        // Mayúsculas y espacios: normalizado es el mismo usuario, y si entrara
        // habría dos cuentas que se creen la misma.
        usuario: "Marcela",
        contrasena: "mandarinas",
        rol: "empleado",
      }),
    );

    expect(codigo).toBe("USUARIO_DUPLICADO");
  });

  it("rechaza contraseñas cortas y nombres de ingreso con símbolos raros", async () => {
    expect(
      await codigoDelError(() =>
        crearUsuario({
          nombre: "Marcela",
          usuario: "marcela",
          contrasena: "corta",
          rol: "empleado",
        }),
      ),
    ).toBe("CONTRASENA_INVALIDA");

    expect(
      await codigoDelError(() =>
        crearUsuario({
          nombre: "Marcela",
          usuario: "marce la!",
          contrasena: "mandarinas",
          rol: "empleado",
        }),
      ),
    ).toBe("USUARIO_INVALIDO");
  });

  it("nunca devuelve el hash de la contraseña", async () => {
    const creado = await crearAdmin();

    expect(Object.keys(creado)).not.toContain("hashContrasena");
  });
});

describe("primer arranque", () => {
  it("sin usuarios, el sistema no está inicializado", async () => {
    expect(await haySistemaInicializado()).toBe(false);
  });

  it("crea el primer administrador con todos los permisos", async () => {
    const primero = await crearPrimerAdministrador({
      nombre: "Rami Vélez",
      usuario: "rami",
      contrasena: "naranjas2026",
    });

    expect(primero.rol).toBe("admin");
    expect(primero.permisos).toContain("usuarios.configurar");
    expect(await haySistemaInicializado()).toBe(true);
  });

  it("no se puede usar dos veces", async () => {
    await crearPrimerAdministrador({
      nombre: "Rami Vélez",
      usuario: "rami",
      contrasena: "naranjas2026",
    });

    const codigo = await codigoDelError(() =>
      crearPrimerAdministrador({
        nombre: "Intruso",
        usuario: "intruso",
        contrasena: "naranjas2026",
      }),
    );

    expect(codigo).toBe("SISTEMA_YA_INICIALIZADO");
  });

  it("tampoco se puede usar si el único usuario está de baja", async () => {
    // El sistema ya se usó: la pantalla de primer arranque, que crea un
    // administrador sin pedir credenciales, sería una puerta abierta.
    const primero = await crearAdmin();
    await crearUsuario({
      nombre: "Otro admin",
      usuario: "otro",
      contrasena: "naranjas2026",
      rol: "admin",
    });
    await cambiarActivacion(primero.id, false, COMO_ADMIN);

    expect(await haySistemaInicializado()).toBe(true);
  });
});

describe("ingreso", () => {
  it("acepta la contraseña correcta", async () => {
    const creado = await crearAdmin();

    const autenticado = await verificarCredenciales("rami", "naranjas2026");

    expect(autenticado.id).toBe(creado.id);
  });

  it("entra igual escribiendo el usuario con mayúsculas", async () => {
    await crearAdmin();

    const autenticado = await verificarCredenciales("RAMI", "naranjas2026");

    expect(autenticado.usuario).toBe("rami");
  });

  it("rechaza la contraseña equivocada", async () => {
    await crearAdmin();

    expect(await codigoDelError(() => verificarCredenciales("rami", "otra"))).toBe(
      "CREDENCIALES_INVALIDAS",
    );
  });

  it("da el mismo error para un usuario que no existe", async () => {
    // Distinguirlos le confirma a cualquiera qué nombres de usuario existen.
    expect(
      await codigoDelError(() => verificarCredenciales("fantasma", "naranjas2026")),
    ).toBe("CREDENCIALES_INVALIDAS");
  });

  it("no deja entrar a una cuenta dada de baja", async () => {
    const creado = await crearAdmin();
    await crearUsuario({
      nombre: "Otro admin",
      usuario: "otro",
      contrasena: "naranjas2026",
      rol: "admin",
    });
    await cambiarActivacion(creado.id, false, COMO_ADMIN);

    expect(await codigoDelError(() => verificarCredenciales("rami", "naranjas2026"))).toBe(
      "USUARIO_INACTIVO",
    );
  });
});

describe("sesiones", () => {
  it("resuelve el token al usuario", async () => {
    const creado = await crearAdmin();
    const token = await abrirSesion(creado.id);

    const sesion = await usuarioDeSesion(token);

    expect(sesion?.usuario.id).toBe(creado.id);
  });

  it("no guarda el token en claro", async () => {
    // Una copia de la base no puede alcanzar para armar la cookie de otro.
    const creado = await crearAdmin();
    const token = await abrirSesion(creado.id);

    const guardadas = await prisma.sesionUsuario.findMany();

    expect(guardadas[0].hashToken).not.toBe(token);
  });

  it("un token inventado no resuelve a nadie", async () => {
    expect(await usuarioDeSesion("token-que-no-existe")).toBeNull();
  });

  it("cerrar sesión la invalida", async () => {
    const creado = await crearAdmin();
    const token = await abrirSesion(creado.id);

    await cerrarSesion(token);

    expect(await usuarioDeSesion(token)).toBeNull();
  });

  it("los permisos se leen de la base, no del token", async () => {
    // Es lo que hace que destildar un checkbox tenga efecto en el próximo click,
    // y no recién cuando la persona vuelva a entrar.
    const creado = await crearAdmin();
    const otro = await crearUsuario({
      nombre: "Segundo admin",
      usuario: "segundo",
      contrasena: "naranjas2026",
      rol: "admin",
    });
    const token = await abrirSesion(creado.id);

    await actualizarPermisos(creado.id, ["caja.ver"], COMO_ADMIN);

    const sesion = await usuarioDeSesion(token);
    expect(sesion?.usuario.permisos).toEqual(["caja.ver"]);
    expect(otro.permisos).toContain("usuarios.configurar");
  });

  it("dar de baja a alguien le cierra las sesiones", async () => {
    const creado = await crearAdmin();
    await crearUsuario({
      nombre: "Otro admin",
      usuario: "otro",
      contrasena: "naranjas2026",
      rol: "admin",
    });
    const token = await abrirSesion(creado.id);

    await cambiarActivacion(creado.id, false, COMO_ADMIN);

    expect(await usuarioDeSesion(token)).toBeNull();
    expect(await sesionesDe(creado.id)).toEqual([]);
  });
});

describe("permisos", () => {
  it("reemplaza la lista completa, no agrega", async () => {
    const creado = await crearAdmin();
    await crearUsuario({
      nombre: "Otro admin",
      usuario: "otro",
      contrasena: "naranjas2026",
      rol: "admin",
    });

    const actualizado = await actualizarPermisos(creado.id, ["caja.cargar"], COMO_ADMIN);

    expect(actualizado.permisos).toEqual(["caja.ver", "caja.cargar"]);
  });

  it("no deja que el último que puede configurar se saque el permiso", async () => {
    // Sin esta guarda quedaría una instalación donde ya nadie puede crear usuarios
    // ni restablecer contraseñas, y de ahí solo se sale metiendo mano en la base.
    const solo = await crearAdmin();

    const codigo = await codigoDelError(() =>
      actualizarPermisos(solo.id, ["caja.ver"], COMO_ADMIN),
    );

    expect(codigo).toBe("ULTIMO_ADMINISTRADOR");
  });

  it("sí lo deja si hay otro administrador activo", async () => {
    const primero = await crearAdmin();
    await crearUsuario({
      nombre: "Segunda administradora",
      usuario: "segunda",
      contrasena: "naranjas2026",
      rol: "admin",
    });

    const actualizado = await actualizarPermisos(primero.id, ["caja.ver"], COMO_ADMIN);

    expect(actualizado.permisos).toEqual(["caja.ver"]);
  });

  it("no cuenta a un administrador dado de baja como respaldo", async () => {
    const primero = await crearAdmin();
    const segundo = await crearUsuario({
      nombre: "Segunda administradora",
      usuario: "segunda",
      contrasena: "naranjas2026",
      rol: "admin",
    });
    await cambiarActivacion(segundo.id, false, COMO_ADMIN);

    const codigo = await codigoDelError(() =>
      actualizarPermisos(primero.id, ["caja.ver"], COMO_ADMIN),
    );

    expect(codigo).toBe("ULTIMO_ADMINISTRADOR");
  });

  it("tampoco deja dar de baja al último que puede configurar", async () => {
    const solo = await crearAdmin();

    expect(await codigoDelError(() => cambiarActivacion(solo.id, false, COMO_ADMIN))).toBe(
      "ULTIMO_ADMINISTRADOR",
    );
  });
});

describe("contraseñas", () => {
  it("el administrador restablece y obliga a cambiarla", async () => {
    const creado = await crearAdmin();

    await restablecerContrasena(creado.id, "provisoria1", COMO_ADMIN);

    const autenticado = await verificarCredenciales("rami", "provisoria1");
    expect(autenticado.debeCambiarContrasena).toBe(true);
  });

  it("restablecer cierra las sesiones abiertas", async () => {
    const creado = await crearAdmin();
    const token = await abrirSesion(creado.id);

    await restablecerContrasena(creado.id, "provisoria1", COMO_ADMIN);

    expect(await usuarioDeSesion(token)).toBeNull();
  });

  it("la persona cambia la suya y deja de estar obligada", async () => {
    const creado = await crearAdmin();
    await restablecerContrasena(creado.id, "provisoria1", COMO_ADMIN);

    await cambiarContrasenaPropia(creado.id, "provisoria1", "mandarinas2026");

    const autenticado = await verificarCredenciales("rami", "mandarinas2026");
    expect(autenticado.debeCambiarContrasena).toBe(false);
  });

  it("cambiar la propia exige la actual", async () => {
    // Como las sesiones no se cierran solas, sin esto cualquiera que pase por una
    // máquina con la sesión abierta se queda con la cuenta.
    const creado = await crearAdmin();

    const codigo = await codigoDelError(() =>
      cambiarContrasenaPropia(creado.id, "la-que-no-es", "mandarinas2026"),
    );

    expect(codigo).toBe("CREDENCIALES_INVALIDAS");
  });
});

describe("listado", () => {
  it("muestra también a los dados de baja", async () => {
    // Las cuentas no se borran: si se borraran, todo lo que esa persona cargó
    // quedaría sin autor.
    const primero = await crearAdmin();
    await crearUsuario({
      nombre: "Otro admin",
      usuario: "otro",
      contrasena: "naranjas2026",
      rol: "admin",
    });
    await cambiarActivacion(primero.id, false, COMO_ADMIN);

    const usuarios = await listarUsuarios(COMO_ADMIN);

    expect(usuarios).toHaveLength(2);
    expect(usuarios.some((u) => !u.activo)).toBe(true);
  });
});

/**
 * §9: el administrador es la cuenta técnica. El dueño maneja su negocio y su
 * personal, pero no borra cuentas ni sabe que el rol admin existe.
 */
describe("el dueño no ve a los administradores", () => {
  async function armarLocal() {
    const admin = await crearAdmin("soporte");
    const dueno = await crearUsuario({
      nombre: "Rami Vélez",
      usuario: "rami",
      contrasena: "naranjas2026",
      rol: "dueno",
    });
    const empleada = await crearUsuario({
      nombre: "Marcela Gómez",
      usuario: "marcela",
      contrasena: "mandarinas",
      rol: "empleado",
    });

    return { admin, dueno, empleada };
  }

  it("el listado del dueño no incluye cuentas de administrador", async () => {
    const { dueno, empleada } = await armarLocal();

    const vistos = await listarUsuarios(dueno.permisos);

    expect(vistos.map((u) => u.usuario).sort()).toEqual(["marcela", "rami"]);
    expect(vistos.some((u) => u.rol === "admin")).toBe(false);
    expect(vistos.map((u) => u.id)).toContain(empleada.id);
  });

  it("el listado del administrador las incluye a todas", async () => {
    await armarLocal();

    const vistos = await listarUsuarios(COMO_ADMIN);

    expect(vistos).toHaveLength(3);
  });

  it("abrir una cuenta de administrador le da al dueño el mismo error que una inexistente", async () => {
    // Un "no tenés permiso" le confirmaría que ahí hay algo.
    const { admin, dueno } = await armarLocal();

    expect(await codigoDelError(() => obtenerUsuario(admin.id, dueno.permisos))).toBe(
      "USUARIO_NO_ENCONTRADO",
    );
  });

  it("el dueño no puede tocar una cuenta de administrador por POST directo", async () => {
    const { admin, dueno } = await armarLocal();

    expect(
      await codigoDelError(() => actualizarPermisos(admin.id, ["caja.ver"], dueno.permisos)),
    ).toBe("USUARIO_NO_ENCONTRADO");

    expect(
      await codigoDelError(() => cambiarActivacion(admin.id, false, dueno.permisos)),
    ).toBe("USUARIO_NO_ENCONTRADO");

    expect(
      await codigoDelError(() => restablecerContrasena(admin.id, "otra12345", dueno.permisos)),
    ).toBe("USUARIO_NO_ENCONTRADO");
  });

  it("el dueño no puede ascender a nadie a administrador", async () => {
    const { dueno, empleada } = await armarLocal();

    expect(
      await codigoDelError(() =>
        editarUsuario(empleada.id, { rol: "admin" }, dueno.permisos),
      ),
    ).toBe("PERMISO_DENEGADO");
  });

  it("el dueño no puede darse a sí mismo el permiso de administración", async () => {
    // El formulario es HTML: cualquiera le agrega un checkbox. El filtro que cuenta
    // está en el servidor.
    const { dueno } = await armarLocal();

    const actualizado = await actualizarPermisos(
      dueno.id,
      [...COMO_DUENO, PERMISO_ADMINISTRAR],
      dueno.permisos,
    );

    expect(actualizado.permisos).not.toContain(PERMISO_ADMINISTRAR);
  });

  it("guardar desde la pantalla del dueño no le borra a nadie un permiso invisible", async () => {
    // La grilla del dueño no dibuja `usuarios.administrar`, así que ese permiso no
    // viaja en el POST. Sin la conservación, guardar cualquier cambio se lo
    // llevaría puesto sin que nadie se entere.
    const { dueno, empleada } = await armarLocal();
    await actualizarPermisos(empleada.id, [...COMO_DUENO, PERMISO_ADMINISTRAR], COMO_ADMIN);

    const actualizado = await actualizarPermisos(empleada.id, ["caja.ver"], dueno.permisos);

    expect(actualizado.permisos).toContain(PERMISO_ADMINISTRAR);
    expect(actualizado.permisos).toContain("caja.ver");
  });
});

describe("borrado de cuentas", () => {
  it("el administrador borra y la cuenta desaparece", async () => {
    const admin = await crearAdmin();
    const empleada = await crearUsuario({
      nombre: "Marcela Gómez",
      usuario: "marcela",
      contrasena: "mandarinas",
      rol: "empleado",
    });

    await borrarUsuario(empleada.id, { id: admin.id, permisos: COMO_ADMIN });

    expect(await prisma.usuario.findUnique({ where: { id: empleada.id } })).toBeNull();
  });

  it("lo que cargó queda sin autor, no se borra", async () => {
    // Es el precio del borrado real, y la razón por la que existe la baja.
    const admin = await crearAdmin();
    const empleada = await crearUsuario({
      nombre: "Marcela Gómez",
      usuario: "marcela",
      contrasena: "mandarinas",
      rol: "empleado",
    });
    const turno = await prisma.turno.create({
      data: { fecha: new Date("2026-08-22"), nombre: "mañana", usuarioId: empleada.id },
    });

    await borrarUsuario(empleada.id, { id: admin.id, permisos: COMO_ADMIN });

    const sobreviviente = await prisma.turno.findUniqueOrThrow({ where: { id: turno.id } });
    expect(sobreviviente.usuarioId).toBeNull();
  });

  it("el dueño no puede borrar", async () => {
    const dueno = await crearUsuario({
      nombre: "Rami Vélez",
      usuario: "rami",
      contrasena: "naranjas2026",
      rol: "dueno",
    });
    const empleada = await crearUsuario({
      nombre: "Marcela Gómez",
      usuario: "marcela",
      contrasena: "mandarinas",
      rol: "empleado",
    });

    expect(
      await codigoDelError(() =>
        borrarUsuario(empleada.id, { id: dueno.id, permisos: dueno.permisos }),
      ),
    ).toBe("PERMISO_DENEGADO");
  });

  it("nadie borra su propia cuenta", async () => {
    const admin = await crearAdmin();
    await crearUsuario({
      nombre: "Segundo admin",
      usuario: "segundo",
      contrasena: "naranjas2026",
      rol: "admin",
    });

    expect(
      await codigoDelError(() =>
        borrarUsuario(admin.id, { id: admin.id, permisos: COMO_ADMIN }),
      ),
    ).toBe("ULTIMO_ADMINISTRADOR");
  });

  it("no se puede borrar al último administrador", async () => {
    // Sin nadie con permiso de administración, no hay forma de recrear la cuenta
    // técnica desde adentro: quien queda no ve ese rol ni ese permiso.
    const admin = await crearAdmin();
    const otroAdmin = await crearUsuario({
      nombre: "Segundo admin",
      usuario: "segundo",
      contrasena: "naranjas2026",
      rol: "admin",
    });
    await actualizarPermisos(otroAdmin.id, COMO_DUENO, COMO_ADMIN);

    expect(
      await codigoDelError(() =>
        borrarUsuario(admin.id, { id: otroAdmin.id, permisos: COMO_ADMIN }),
      ),
    ).toBe("ULTIMO_ADMINISTRADOR");
  });
});
