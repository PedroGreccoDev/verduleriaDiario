import { prisma } from "@/lib/prisma";
import { CERO, type Decimal } from "@/lib/decimal";
import { soloFecha } from "@/lib/fecha";
import { categoriasCargables } from "./categorias";
import { proximoTurnoSugerido, turnosSugeridos, type NombreTurno } from "./calendario";

/** Consultas de lectura para la pantalla de caja. Sin efectos. */

/** Las categorías que el operador puede elegir al cargar un movimiento a mano. */
export async function categoriasParaCargarAMano() {
  return categoriasCargables(prisma);
}

export interface MovimientoDeTurno {
  id: string;
  fecha: Date;
  tipo: "ingreso" | "egreso";
  categoria: string;
  monto: Decimal;
  observacion: string | null;
  /**
   * Quién lo cargó. `null` es un movimiento anterior a los usuarios (§9): no se
   * le inventa un autor, se muestra como tal.
   */
  autor: string | null;
}

export interface EstadoCaja {
  turnoAbierto: {
    id: string;
    nombre: string;
    fecha: Date;
    fechaApertura: Date;
    observacion: string | null;
    /** Quién lo abrió. `null` si es anterior a los usuarios. */
    autor: string | null;
  } | null;
  movimientos: MovimientoDeTurno[];
  totalIngresos: Decimal;
  totalEgresos: Decimal;
  /** Solo los retiros: es lo que se depositó en la Bolsa Grande en este turno. */
  totalRetirado: Decimal;
  turnosDelDia: { id: string; nombre: string; estado: string; fechaCierre: Date | null }[];
  sugeridos: NombreTurno[];
  proximoSugerido: NombreTurno | null;
}

export async function obtenerEstadoCaja(hoy: Date = new Date()): Promise<EstadoCaja> {
  const fecha = soloFecha(hoy);

  const [turnoAbierto, turnosDelDia] = await Promise.all([
    prisma.turno.findFirst({
      where: { estado: "abierto" },
      include: { usuario: { select: { nombre: true } } },
    }),
    prisma.turno.findMany({
      where: { fecha },
      orderBy: { fechaApertura: "asc" },
      select: { id: true, nombre: true, estado: true, fechaCierre: true },
    }),
  ]);

  const movimientos = turnoAbierto
    ? await prisma.movimientoCaja.findMany({
        where: { turnoId: turnoAbierto.id },
        include: {
          categoria: true,
          // Solo el nombre: la pantalla no necesita nada más del usuario, y traer
          // la fila entera arrastraría el hash de la contraseña hasta el render.
          usuario: { select: { nombre: true } },
        },
        orderBy: { fecha: "asc" },
      })
    : [];

  let totalIngresos = CERO;
  let totalEgresos = CERO;
  let totalRetirado = CERO;

  for (const movimiento of movimientos) {
    if (movimiento.tipo === "ingreso") {
      totalIngresos = totalIngresos.plus(movimiento.monto);
      if (movimiento.categoria.slug === "retiro_turno") {
        totalRetirado = totalRetirado.plus(movimiento.monto);
      }
    } else {
      totalEgresos = totalEgresos.plus(movimiento.monto);
    }
  }

  return {
    turnoAbierto: turnoAbierto
      ? {
          id: turnoAbierto.id,
          nombre: turnoAbierto.nombre,
          fecha: turnoAbierto.fecha,
          fechaApertura: turnoAbierto.fechaApertura,
          observacion: turnoAbierto.observacion,
          autor: turnoAbierto.usuario?.nombre ?? null,
        }
      : null,
    movimientos: movimientos.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      categoria: m.categoria.nombre,
      monto: m.monto,
      observacion: m.observacion,
      autor: m.usuario?.nombre ?? null,
    })),
    totalIngresos,
    totalEgresos,
    totalRetirado,
    turnosDelDia,
    sugeridos: turnosSugeridos(hoy),
    proximoSugerido: proximoTurnoSugerido(
      hoy,
      turnosDelDia.map((t) => t.nombre),
    ),
  };
}
