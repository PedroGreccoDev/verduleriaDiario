import type { RolUsuario } from "@/generated/prisma/enums";

/**
 * Catálogo de permisos (§9).
 *
 * Vive en el código y no en una tabla configurable. Las secciones y las acciones
 * del sistema las define el programa: un permiso que no existe en el código no lo
 * puede aplicar nadie, y una fila suelta en la base con un permiso inventado no
 * habilitaría nada. Lo que SÍ es configurable —y es lo que se pidió— es qué
 * permisos de esta lista tiene cada persona.
 *
 * La grilla que ve el dueño es exactamente esta estructura: las secciones son las
 * filas y las acciones son las columnas.
 */

/** Qué se puede hacer dentro de una sección. */
export const ACCIONES = ["ver", "cargar", "anular"] as const;
export type Accion = (typeof ACCIONES)[number];

export const ETIQUETA_ACCION: Record<Accion, string> = {
  ver: "Ver",
  cargar: "Cargar",
  anular: "Anular",
};

/** Qué significa cada columna, para que el dueño no tenga que adivinar. */
export const DESCRIPCION_ACCION: Record<Accion, string> = {
  ver: "Entrar a la sección y mirar lo que hay.",
  cargar: "Registrar operaciones nuevas.",
  anular: "Dar de baja algo mal cargado y devolver los saldos.",
};

export interface SeccionPermisos {
  clave: string;
  etiqueta: string;
  /** Ruta que gobierna. Con esto se filtra la barra lateral. */
  ruta: string;
  /**
   * Reportes solo se mira: no se carga ni se anula nada ahí. Por eso las acciones
   * son por sección y no una lista fija — pintar tres casillas donde dos no
   * significan nada invita a tildarlas y a preguntarse después por qué no hacen.
   */
  acciones: readonly Accion[];
}

export const SECCIONES: readonly SeccionPermisos[] = [
  { clave: "caja", etiqueta: "Caja", ruta: "/caja", acciones: ACCIONES },
  { clave: "cheques", etiqueta: "Cheques", ruta: "/cheques", acciones: ACCIONES },
  { clave: "proveedores", etiqueta: "Proveedores", ruta: "/proveedores", acciones: ACCIONES },
  { clave: "clientes", etiqueta: "Clientes", ruta: "/clientes", acciones: ACCIONES },
  { clave: "reportes", etiqueta: "Reportes", ruta: "/reportes", acciones: ["ver"] },
] as const;

/**
 * El permiso que separa al administrador del dueño (§9).
 *
 * Da dos cosas que el dueño no tiene: borrar cuentas de verdad, y ver y tocar las
 * cuentas de administrador. Además se OCULTA de la grilla a quien no lo tiene, así
 * que un dueño mirando la pantalla de usuarios no encuentra ni el permiso ni el
 * rol: para él, el sistema tiene dueños y empleados.
 *
 * Esto es discreción, no aislamiento. Si una cuenta de administrador carga un
 * movimiento, su nombre aparece en la columna "cargó" como el de cualquiera; lo
 * que se esconde son las pantallas de usuarios, no el rastro de lo que hizo.
 */
export const PERMISO_ADMINISTRAR = "usuarios.administrar";

/**
 * Permisos que no son de una sección.
 *
 * Abrir y cerrar turno va acá y no como una acción de Caja porque no es cargar un
 * movimiento: es abrir y cerrar el día. Hay locales donde el que carga los gastos
 * no es el que decide que la jornada terminó.
 */
export interface PermisoSuelto {
  clave: string;
  etiqueta: string;
  descripcion: string;
}

export const PERMISOS_SUELTOS: readonly PermisoSuelto[] = [
  {
    clave: "turno.gestionar",
    etiqueta: "Abrir y cerrar turno",
    descripcion: "Empezar la jornada y cerrarla con el retiro final.",
  },
  {
    clave: "usuarios.configurar",
    etiqueta: "Configurar usuarios",
    descripcion:
      "Crear personas, cambiarles los permisos, restablecerles la contraseña y " +
      "darlas de baja. Quien tiene esto puede darse a sí mismo cualquier otro " +
      "permiso que pueda ver.",
  },
  {
    clave: PERMISO_ADMINISTRAR,
    etiqueta: "Borrar cuentas y administrar el sistema",
    descripcion:
      "Borrar una cuenta de verdad, no solo darla de baja, y ver y tocar las " +
      "cuentas de administrador. Es el permiso de la cuenta técnica.",
  },
] as const;

/** Todos los permisos que existen, en el orden en que se muestran. */
export const PERMISOS: readonly string[] = [
  ...SECCIONES.flatMap((seccion) =>
    seccion.acciones.map((accion) => `${seccion.clave}.${accion}`),
  ),
  ...PERMISOS_SUELTOS.map((permiso) => permiso.clave),
];

const PERMISOS_VALIDOS = new Set(PERMISOS);

export function esPermisoValido(permiso: string): boolean {
  return PERMISOS_VALIDOS.has(permiso);
}

/**
 * Cargar o anular sin poder ver es una combinación que no significa nada: la
 * persona no puede llegar a la pantalla donde estaría el botón. En vez de
 * prohibirla con un error, se completa sola.
 *
 * Se aplica al guardar, no al leer, para que lo que está en la base sea lo que se
 * muestra en la grilla. Si se normalizara al leer, el dueño destildaría "Ver",
 * guardaría, y la casilla volvería a aparecer tildada sin explicación.
 */
export function normalizarPermisos(permisos: Iterable<string>): string[] {
  const concedidos = new Set<string>();

  for (const permiso of permisos) {
    if (!esPermisoValido(permiso)) continue;
    concedidos.add(permiso);

    const [seccion, accion] = permiso.split(".");
    if (accion === "cargar" || accion === "anular") {
      concedidos.add(`${seccion}.ver`);
    }
  }

  // Se devuelve en el orden del catálogo y no en el de entrada: así dos usuarios
  // con los mismos permisos producen la misma lista y los tests no dependen del
  // orden en que vinieron los checkboxes del formulario.
  return PERMISOS.filter((permiso) => concedidos.has(permiso));
}

/**
 * Plantillas de rol.
 *
 * Son el punto de partida al crear un usuario, NADA MÁS: una vez creado, quien
 * decide es su lista de permisos. Cambiar una plantilla acá no cambia lo que
 * puede hacer nadie que ya exista, y eso es deliberado — un empleado al que le
 * ajustaron los permisos a mano no debería perderlos porque se editó el rol.
 *
 * El dueño arranca con TODO salvo `usuarios.administrar`: maneja su negocio y su
 * personal —crea, edita, restablece contraseñas y da de baja— pero no borra
 * cuentas ni ve las de administrador. El admin es la cuenta técnica y tiene las
 * dos cosas.
 */
export const PLANTILLAS_ROL: Record<RolUsuario, readonly string[]> = {
  admin: PERMISOS,

  dueno: PERMISOS.filter((permiso) => permiso !== PERMISO_ADMINISTRAR),

  // El empleado carga el mostrador: caja y fiado. No anula nada, no ve la cartera
  // de cheques ni los reportes del negocio, y no configura a nadie.
  empleado: normalizarPermisos([
    "caja.cargar",
    "clientes.cargar",
    "proveedores.ver",
    "turno.gestionar",
  ]),
};

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  dueno: "Dueño",
  admin: "Administrador",
  empleado: "Empleado",
};

export const DESCRIPCION_ROL: Record<RolUsuario, string> = {
  dueno: "Puede todo: anula, configura usuarios y da de baja. No borra cuentas.",
  admin: "Puede todo, incluido borrar cuentas. Es la cuenta que administra el sistema.",
  empleado: "Carga caja y fiado. No anula ni ve los números del negocio.",
};

const ROLES_TODOS: readonly RolUsuario[] = ["dueno", "admin", "empleado"];

/**
 * Los roles que puede elegir quien está mirando la pantalla.
 *
 * Sin `usuarios.administrar` no aparece "Administrador": para el dueño, el sistema
 * tiene dueños y empleados y nada más. Es la contracara de que tampoco vea las
 * cuentas con ese rol — si el selector lo ofreciera, el rol quedaría a la vista
 * aunque ninguna cuenta se mostrara.
 */
export function rolesVisiblesPara(permisosDelObservador: readonly string[]): readonly RolUsuario[] {
  if (permisosDelObservador.includes(PERMISO_ADMINISTRAR)) return ROLES_TODOS;

  return ROLES_TODOS.filter((rol) => rol !== "admin");
}

/**
 * Los permisos sueltos que se le muestran a quien está mirando.
 *
 * Mismo criterio: `usuarios.administrar` no se dibuja para quien no lo tiene.
 * Nadie puede otorgar un permiso que no ve, y el servidor lo vuelve a comprobar
 * en `permisosOtorgablesPor`.
 */
export function permisosSueltosVisiblesPara(
  permisosDelObservador: readonly string[],
): readonly PermisoSuelto[] {
  if (permisosDelObservador.includes(PERMISO_ADMINISTRAR)) return PERMISOS_SUELTOS;

  return PERMISOS_SUELTOS.filter((permiso) => permiso.clave !== PERMISO_ADMINISTRAR);
}

/**
 * Qué permisos puede conceder o quitar este observador.
 *
 * Es la mitad de servidor de la regla de arriba, y la que importa: el formulario
 * es HTML y cualquiera puede agregarle un checkbox a mano. Sin este filtro, un
 * dueño podría mandar `usuarios.administrar` en el POST y ascenderse solo.
 */
export function permisosOtorgablesPor(
  permisosDelObservador: readonly string[],
): readonly string[] {
  if (permisosDelObservador.includes(PERMISO_ADMINISTRAR)) return PERMISOS;

  return PERMISOS.filter((permiso) => permiso !== PERMISO_ADMINISTRAR);
}

/** ¿Este observador puede ver y tocar la cuenta de alguien con este rol? */
export function puedeVerCuentaConRol(
  permisosDelObservador: readonly string[],
  rol: RolUsuario,
): boolean {
  if (rol !== "admin") return true;

  return permisosDelObservador.includes(PERMISO_ADMINISTRAR);
}

/** Etiqueta legible de un permiso, para mensajes de error. */
export function etiquetaPermiso(permiso: string): string {
  const suelto = PERMISOS_SUELTOS.find((p) => p.clave === permiso);
  if (suelto) return suelto.etiqueta;

  const [claveSeccion, accion] = permiso.split(".");
  const seccion = SECCIONES.find((s) => s.clave === claveSeccion);

  if (!seccion || !accion) return permiso;

  return `${ETIQUETA_ACCION[accion as Accion]} ${seccion.etiqueta.toLowerCase()}`;
}
