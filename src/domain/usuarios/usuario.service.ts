import { prisma, type PrismaTx } from "@/lib/prisma";
import { errorDominio } from "@/lib/errores";
import { hashearContrasena, validarContrasena, verificarContrasena } from "@/lib/contrasena";
import type { RolUsuario } from "@/generated/prisma/enums";
import {
  normalizarPermisos,
  permisosOtorgablesPor,
  puedeVerCuentaConRol,
  PERMISO_ADMINISTRAR,
  PLANTILLAS_ROL,
} from "./permisos";

/**
 * Alta y mantenimiento de usuarios (§9).
 *
 * Hay dos formas de sacar a alguien del sistema, y no son lo mismo:
 *
 *   - **Baja** (`cambiarActivacion`): la cuenta queda, no puede entrar, y todo lo
 *     que cargó sigue mostrando su nombre. Es lo que hace el dueño.
 *   - **Borrado** (`borrarUsuario`): la cuenta desaparece y sus movimientos quedan
 *     sin autor, con el mismo "—" que lo anterior a los usuarios. Se pierde para
 *     siempre quién los cargó. Requiere `usuarios.administrar`.
 *
 * El borrado es destructivo por diseño: existe para que una cuenta pueda
 * desaparecer de verdad. Quien quiera conservar la autoría tiene la baja.
 */

/** Lo que se muestra en pantalla. Nunca incluye el hash de la contraseña. */
export interface UsuarioVisible {
  id: string;
  nombre: string;
  usuario: string;
  rol: RolUsuario;
  activo: boolean;
  debeCambiarContrasena: boolean;
  creadoEn: Date;
  permisos: string[];
}

/**
 * El nombre de ingreso se guarda en minúsculas y sin espacios: "Marcela" y
 * "marcela" tienen que ser la misma persona, o el día que alguien no pueda entrar
 * nadie va a entender por qué.
 */
export function normalizarNombreUsuario(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, "");
}

function validarNombreUsuario(usuario: string): void {
  if (usuario.length < 3) {
    throw errorDominio(
      "USUARIO_INVALIDO",
      "El nombre de ingreso necesita al menos 3 caracteres.",
    );
  }

  if (!/^[a-z0-9._-]+$/.test(usuario)) {
    throw errorDominio(
      "USUARIO_INVALIDO",
      "El nombre de ingreso solo admite letras sin acento, números, punto, guion y guion bajo.",
    );
  }
}

function aVisible(usuario: {
  id: string;
  nombre: string;
  usuario: string;
  rol: RolUsuario;
  activo: boolean;
  debeCambiarContrasena: boolean;
  creadoEn: Date;
  permisos: { permiso: string }[];
}): UsuarioVisible {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    usuario: usuario.usuario,
    rol: usuario.rol,
    activo: usuario.activo,
    debeCambiarContrasena: usuario.debeCambiarContrasena,
    creadoEn: usuario.creadoEn,
    permisos: usuario.permisos.map((p) => p.permiso),
  };
}

export interface DatosAltaUsuario {
  nombre: string;
  usuario: string;
  contrasena: string;
  rol: RolUsuario;
  /**
   * Si se omite, se usa la plantilla del rol. Si viene, manda lo que viene: la
   * pantalla envía los checkboxes tal como quedaron después de que el dueño los
   * ajustó, que puede no coincidir con ninguna plantilla.
   */
  permisos?: readonly string[];
  /** Obliga a elegir contraseña propia en el primer ingreso. */
  debeCambiarContrasena?: boolean;
}

export async function crearUsuario(datos: DatosAltaUsuario): Promise<UsuarioVisible> {
  const nombre = datos.nombre.trim();
  const usuario = normalizarNombreUsuario(datos.usuario);

  if (!nombre) {
    throw errorDominio("NOMBRE_REQUERIDO", "Poné el nombre de la persona.");
  }

  validarNombreUsuario(usuario);

  const problema = validarContrasena(datos.contrasena);
  if (problema) throw errorDominio("CONTRASENA_INVALIDA", problema);

  const permisos = normalizarPermisos(datos.permisos ?? PLANTILLAS_ROL[datos.rol]);
  const hash = await hashearContrasena(datos.contrasena);

  return prisma.$transaction(async (tx) => {
    const existente = await tx.usuario.findUnique({ where: { usuario } });

    if (existente) {
      throw errorDominio(
        "USUARIO_DUPLICADO",
        `Ya hay alguien que entra como "${usuario}". Elegí otro nombre de ingreso.`,
      );
    }

    const creado = await tx.usuario.create({
      data: {
        nombre,
        usuario,
        hashContrasena: hash,
        rol: datos.rol,
        debeCambiarContrasena: datos.debeCambiarContrasena ?? false,
        permisos: { create: permisos.map((permiso) => ({ permiso })) },
      },
      include: { permisos: true },
    });

    return aVisible(creado);
  });
}

/**
 * ¿Ya hay alguien cargado?
 *
 * Con `false`, la aplicación entera se va a la pantalla de primer arranque. Se
 * cuenta sobre todos los usuarios y no solo los activos: si quedan usuarios
 * desactivados, el sistema ya se usó y la pantalla de primer arranque —que crea
 * un administrador sin pedir credenciales— sería una puerta abierta.
 */
export async function haySistemaInicializado(): Promise<boolean> {
  return (await prisma.usuario.count()) > 0;
}

/**
 * Crea el primer administrador. Solo funciona con la base sin usuarios.
 *
 * La verificación va DENTRO de la transacción y vuelve a contar: si no, dos
 * pestañas abiertas en la pantalla de primer arranque crean dos administradores,
 * y el segundo lo crea quien no debería.
 */
export async function crearPrimerAdministrador(
  datos: Omit<DatosAltaUsuario, "rol" | "permisos">,
): Promise<UsuarioVisible> {
  if (await haySistemaInicializado()) {
    throw errorDominio(
      "SISTEMA_YA_INICIALIZADO",
      "El sistema ya tiene usuarios. Pedile a un administrador que te cree la cuenta.",
    );
  }

  return crearUsuario({ ...datos, rol: "admin" });
}

/** Autentica. Devuelve el usuario o tira `CREDENCIALES_INVALIDAS`. */
export async function verificarCredenciales(
  nombreUsuario: string,
  contrasena: string,
): Promise<UsuarioVisible> {
  const usuario = await prisma.usuario.findUnique({
    where: { usuario: normalizarNombreUsuario(nombreUsuario) },
    include: { permisos: true },
  });

  // El mismo mensaje para "no existe" y para "contraseña equivocada", a propósito:
  // distinguirlos le confirma a cualquiera qué nombres de usuario existen.
  const generico = errorDominio(
    "CREDENCIALES_INVALIDAS",
    "Usuario o contraseña incorrectos.",
  );

  if (!usuario) {
    // Se verifica igual contra un hash descartable para que fallar por usuario
    // inexistente tarde lo mismo que fallar por contraseña: si no, el tiempo de
    // respuesta delata qué usuarios existen.
    await verificarContrasena(contrasena, "scrypt$32768$8$1$c2FsdGFkbw==$aGFzaA==");
    throw generico;
  }

  if (!(await verificarContrasena(contrasena, usuario.hashContrasena))) {
    throw generico;
  }

  if (!usuario.activo) {
    throw errorDominio(
      "USUARIO_INACTIVO",
      `La cuenta de ${usuario.nombre} está dada de baja. Hablá con un administrador.`,
    );
  }

  return aVisible(usuario);
}

/**
 * Las cuentas que este observador puede ver.
 *
 * Sin `usuarios.administrar` no se listan las de rol admin (§9): para el dueño,
 * el sistema tiene dueños y empleados. El filtro va en la consulta y no después,
 * para que ni siquiera lleguen al proceso que arma la pantalla.
 */
export async function listarUsuarios(
  permisosDelObservador: readonly string[],
): Promise<UsuarioVisible[]> {
  const puedeAdministrar = permisosDelObservador.includes(PERMISO_ADMINISTRAR);

  const usuarios = await prisma.usuario.findMany({
    where: puedeAdministrar ? {} : { rol: { not: "admin" } },
    include: { permisos: true },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });

  return usuarios.map(aVisible);
}

/**
 * Una cuenta puntual, si este observador puede verla.
 *
 * Una cuenta de administrador le da a un dueño el MISMO error que una que no
 * existe, a propósito: un "no tenés permiso" le confirmaría que ahí hay algo, que
 * es justo lo que se quiso evitar.
 */
export async function obtenerUsuario(
  id: string,
  permisosDelObservador: readonly string[],
): Promise<UsuarioVisible> {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    include: { permisos: true },
  });

  if (!usuario || !puedeVerCuentaConRol(permisosDelObservador, usuario.rol)) {
    throw errorDominio("USUARIO_NO_ENCONTRADO", `No existe el usuario ${id}.`);
  }

  return aVisible(usuario);
}

/**
 * Guarda que corre antes de tocar la cuenta de otro: si el observador no puede
 * verla, para él no existe.
 *
 * Va dentro de cada operación de escritura y no solo en la pantalla, porque las
 * Server Actions reciben el id por POST y se alcanzan sin pasar por ninguna.
 */
async function exigirObjetivoVisible(
  tx: PrismaTx,
  usuarioId: string,
  permisosDelObservador: readonly string[],
) {
  const objetivo = await tx.usuario.findUnique({ where: { id: usuarioId } });

  if (!objetivo || !puedeVerCuentaConRol(permisosDelObservador, objetivo.rol)) {
    throw errorDominio("USUARIO_NO_ENCONTRADO", `No existe el usuario ${usuarioId}.`);
  }

  return objetivo;
}

/**
 * Reemplaza la lista de permisos de un usuario por la que llega de la grilla.
 *
 * Es un reemplazo y no un agregado: la pantalla manda el estado completo de los
 * checkboxes, así que lo que no vino es lo que se destildó. Va en transacción
 * porque borrar y volver a crear en dos pasos deja, en el medio, a un usuario sin
 * ningún permiso — y con la sesión leyéndose de la base en cada request, alguien
 * que estuviera trabajando en ese instante vería la pantalla vacía.
 */
export async function actualizarPermisos(
  usuarioId: string,
  permisos: readonly string[],
  permisosDelObservador: readonly string[],
): Promise<UsuarioVisible> {
  return prisma.$transaction(async (tx) => {
    await exigirObjetivoVisible(tx, usuarioId, permisosDelObservador);

    const otorgables = new Set(permisosOtorgablesPor(permisosDelObservador));

    // Dos filtros que hacen lo mismo desde los dos lados:
    //
    //   1. Lo que llegó del formulario y el actor NO puede otorgar se descarta. El
    //      formulario es HTML: cualquiera puede agregarle un checkbox a mano, y sin
    //      esto un dueño se ascendería a administrador con un POST.
    //   2. Lo que el objetivo YA tenía y el actor no puede ver se conserva. Si no,
    //      un permiso invisible se borraría solo por guardar la pantalla, y quien
    //      guardó no tendría forma de saber que lo sacó.
    const pedidos = permisos.filter((permiso) => otorgables.has(permiso));

    const actuales = await tx.permisoUsuario.findMany({ where: { usuarioId } });
    const invisiblesQueConserva = actuales
      .map((p) => p.permiso)
      .filter((permiso) => !otorgables.has(permiso));

    const concedidos = normalizarPermisos([...pedidos, ...invisiblesQueConserva]);

    await asegurarQueQuedaAlguienConfigurando(tx, usuarioId, concedidos);

    await tx.permisoUsuario.deleteMany({ where: { usuarioId } });
    await tx.permisoUsuario.createMany({
      data: concedidos.map((permiso) => ({ usuarioId, permiso })),
    });

    const actualizado = await tx.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      include: { permisos: true },
    });

    return aVisible(actualizado);
  });
}

export interface DatosEdicionUsuario {
  nombre?: string;
  rol?: RolUsuario;
}

export async function editarUsuario(
  usuarioId: string,
  datos: DatosEdicionUsuario,
  permisosDelObservador: readonly string[],
): Promise<UsuarioVisible> {
  const nombre = datos.nombre?.trim();

  if (datos.nombre !== undefined && !nombre) {
    throw errorDominio("NOMBRE_REQUERIDO", "El nombre no puede quedar vacío.");
  }

  return prisma.$transaction(async (tx) => {
    await exigirObjetivoVisible(tx, usuarioId, permisosDelObservador);

    // Nadie asciende a alguien a un rol que no puede ver: sin esta guarda, un
    // dueño convertiría a un empleado en administrador mandando rol=admin por POST
    // y esa cuenta le desaparecería de la pantalla.
    if (datos.rol && !puedeVerCuentaConRol(permisosDelObservador, datos.rol)) {
      throw errorDominio("PERMISO_DENEGADO", "No podés asignar ese rol.");
    }

    const actualizado = await tx.usuario.update({
      where: { id: usuarioId },
      data: { ...(nombre ? { nombre } : {}), ...(datos.rol ? { rol: datos.rol } : {}) },
      include: { permisos: true },
    });

    return aVisible(actualizado);
  });
}

/**
 * Borra la cuenta de verdad (§9). Requiere `usuarios.administrar`.
 *
 * Sus movimientos NO se borran: quedan sin autor, con el mismo `null` que lo
 * cargado antes de que existieran los usuarios, gracias al `onDelete: SetNull` de
 * la FK. Es una pérdida de información asumida al elegir el borrado por sobre la
 * baja — y por eso el dueño no lo tiene.
 */
export async function borrarUsuario(
  usuarioId: string,
  observador: { id: string; permisos: readonly string[] },
): Promise<void> {
  if (!observador.permisos.includes(PERMISO_ADMINISTRAR)) {
    throw errorDominio(
      "PERMISO_DENEGADO",
      "Borrar una cuenta requiere permiso de administración. Podés darla de baja.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await exigirObjetivoVisible(tx, usuarioId, observador.permisos);

    // Borrarse a uno mismo cierra la sesión en el próximo click y, si era el último
    // administrador, deja el sistema sin nadie que pueda administrarlo.
    if (usuarioId === observador.id) {
      throw errorDominio(
        "ULTIMO_ADMINISTRADOR",
        "No podés borrar tu propia cuenta. Pedíselo a otro administrador.",
      );
    }

    await asegurarQueQuedaAlguienConfigurando(tx, usuarioId, []);

    // Las sesiones y los permisos caen por cascada; los movimientos quedan
    // huérfanos por SetNull.
    await tx.usuario.delete({ where: { id: usuarioId } });
  });
}

/**
 * Un administrador le pone una contraseña provisoria a alguien que la olvidó.
 *
 * Queda marcado para cambiarla en el próximo ingreso: si no, la contraseña que
 * eligió el admin sigue valiendo para siempre y el admin conoce la clave de todos.
 * También se le cierran todas las sesiones abiertas — restablecer la clave de
 * alguien y dejarle la sesión viva no protege de nada.
 */
export async function restablecerContrasena(
  usuarioId: string,
  contrasenaProvisoria: string,
  permisosDelObservador: readonly string[],
): Promise<void> {
  const problema = validarContrasena(contrasenaProvisoria);
  if (problema) throw errorDominio("CONTRASENA_INVALIDA", problema);

  const hash = await hashearContrasena(contrasenaProvisoria);

  await prisma.$transaction(async (tx) => {
    await exigirObjetivoVisible(tx, usuarioId, permisosDelObservador);

    await tx.usuario.update({
      where: { id: usuarioId },
      data: { hashContrasena: hash, debeCambiarContrasena: true },
    });

    await tx.sesionUsuario.deleteMany({ where: { usuarioId } });
  });
}

/**
 * La persona cambia su propia contraseña. Exige la actual: sin eso, una sesión
 * que quedó abierta —y por decisión del dueño las sesiones no se cierran solas—
 * le permite a cualquiera que pase por la PC apropiarse de la cuenta.
 */
export async function cambiarContrasenaPropia(
  usuarioId: string,
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<void> {
  const problema = validarContrasena(contrasenaNueva);
  if (problema) throw errorDominio("CONTRASENA_INVALIDA", problema);

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });

  if (!usuario) {
    throw errorDominio("USUARIO_NO_ENCONTRADO", `No existe el usuario ${usuarioId}.`);
  }

  if (!(await verificarContrasena(contrasenaActual, usuario.hashContrasena))) {
    throw errorDominio("CREDENCIALES_INVALIDAS", "La contraseña actual no es correcta.");
  }

  const hash = await hashearContrasena(contrasenaNueva);

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { hashContrasena: hash, debeCambiarContrasena: false },
  });
}

/**
 * Baja lógica. Le cierra las sesiones abiertas, porque con sesiones que no expiran
 * un usuario desactivado seguiría trabajando hasta que a alguien se le ocurra
 * tocar "Salir".
 */
export async function cambiarActivacion(
  usuarioId: string,
  activo: boolean,
  permisosDelObservador: readonly string[],
): Promise<UsuarioVisible> {
  return prisma.$transaction(async (tx) => {
    await exigirObjetivoVisible(tx, usuarioId, permisosDelObservador);

    if (!activo) {
      await asegurarQueQuedaAlguienConfigurando(tx, usuarioId, []);
      await tx.sesionUsuario.deleteMany({ where: { usuarioId } });
    }

    const actualizado = await tx.usuario.update({
      where: { id: usuarioId },
      data: { activo },
      include: { permisos: true },
    });

    return aVisible(actualizado);
  });
}

/**
 * Impide dejar al sistema sin nadie que pueda configurarlo o administrarlo.
 *
 * Son las dos formas de quedar encerrado afuera, y la segunda es peor:
 *
 *   - Sin nadie con `usuarios.configurar`, ya nadie crea cuentas ni restablece
 *     contraseñas.
 *   - Sin nadie con `usuarios.administrar`, además desaparece la cuenta técnica
 *     **y no se puede recrear desde adentro**: quien queda no ve el rol admin ni
 *     el permiso, así que no tiene con qué otorgarlos. De ahí solo se sale
 *     metiendo mano en la base.
 *
 * Se comprueba dentro de la misma transacción que hace el cambio, así dos pestañas
 * no pueden sacar cada una "el último" a la vez.
 */
async function asegurarQueQuedaAlguienConfigurando(
  tx: PrismaTx,
  usuarioId: string,
  permisosQueVaATener: readonly string[],
): Promise<void> {
  const controles = [
    {
      permiso: "usuarios.configurar",
      mensaje:
        "Es la única cuenta activa que puede configurar usuarios. Sin ella no queda " +
        "nadie que pueda crear cuentas ni restablecer contraseñas. " +
        "Dale ese permiso a otra persona primero.",
    },
    {
      permiso: PERMISO_ADMINISTRAR,
      mensaje:
        "Es la única cuenta activa con permiso de administración. Sin ella nadie puede " +
        "volver a crear una: quien queda no ve ese rol ni ese permiso. " +
        "Creá otra cuenta de administrador primero.",
    },
  ];

  for (const control of controles) {
    if (permisosQueVaATener.includes(control.permiso)) continue;

    const otros = await tx.usuario.count({
      where: {
        id: { not: usuarioId },
        activo: true,
        permisos: { some: { permiso: control.permiso } },
      },
    });

    if (otros === 0) {
      // Solo importa si la cuenta que se está tocando lo tenía: si no lo tenía,
      // el sistema ya estaba sin nadie y no es este cambio el que lo rompe.
      const loTenia = await tx.permisoUsuario.findFirst({
        where: { usuarioId, permiso: control.permiso },
      });

      if (loTenia) {
        throw errorDominio("ULTIMO_ADMINISTRADOR", control.mensaje);
      }
    }
  }
}
