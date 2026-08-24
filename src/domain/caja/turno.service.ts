import { prisma, type PrismaTx } from "@/lib/prisma";
import { formatearMonto, type Decimal } from "@/lib/decimal";
import { errorDominio } from "@/lib/errores";
import { esDiaAnterior, formatearFecha, soloFecha } from "@/lib/fecha";
import { registrarRetiro } from "./retiro.service";

export interface DatosAperturaTurno {
  /** 'mañana' | 'tarde'. String libre: §8.4 sin resolver. */
  nombre: string;
  fecha?: Date;
  observacion?: string | null;
  /** Quién abre el turno (§9). */
  usuarioId?: string | null;
}

export async function obtenerTurnoAbierto(cliente: PrismaTx = prisma) {
  return cliente.turno.findFirst({ where: { estado: "abierto" } });
}

/**
 * Abre un turno (§4.1).
 *
 * Validación: no puede haber dos turnos abiertos a la vez. La base lo garantiza
 * además con un índice único parcial; acá se comprueba antes para poder dar un
 * mensaje que diga cuál es el turno que quedó abierto.
 *
 * §4.1 pide "advertir si se abre un turno con otro sin cerrar del día anterior".
 * Como dos turnos abiertos son imposibles, esa advertencia y el error son la misma
 * situación; se distinguen por código para que la UI pueda dar el mensaje preciso.
 */
export async function abrirTurno(datos: DatosAperturaTurno) {
  const fecha = soloFecha(datos.fecha);

  return prisma.$transaction(async (tx) => {
    const abierto = await obtenerTurnoAbierto(tx);

    if (abierto) {
      const esDeAntes = esDiaAnterior(abierto.fecha, fecha);

      throw errorDominio(
        esDeAntes ? "TURNO_ANTERIOR_SIN_CERRAR" : "TURNO_YA_ABIERTO",
        esDeAntes
          ? `Quedó sin cerrar el turno ${abierto.nombre} del ${formatearFecha(abierto.fecha)}. ` +
            "Cerralo antes de abrir uno nuevo."
          : `Ya hay un turno abierto (${abierto.nombre} del ${formatearFecha(abierto.fecha)}).`,
      );
    }

    return tx.turno.create({
      data: {
        fecha,
        nombre: datos.nombre,
        estado: "abierto",
        observacion: datos.observacion ?? null,
        usuarioId: datos.usuarioId ?? null,
      },
    });
  });
}

export interface DatosCierreTurno {
  turnoId: string;
  /**
   * Efectivo que quedó en la registradora y se deposita en la Bolsa Grande al
   * cerrar (§4.1, paso 3). Si es null o cero, el turno cierra sin retiro: puede
   * haberse retirado todo antes con retiros parciales.
   */
  montoRetiro?: Decimal | null;
  fechaCierre?: Date;
  observacionRetiro?: string | null;
  /**
   * Quién cierra (§9). Va al retiro de cierre, no al turno: el `usuario_id` del
   * turno es el de quien lo abrió, y sobrescribirlo al cerrar borraría ese dato.
   */
  usuarioId?: string | null;
}

/**
 * Cierra el turno y, si se indica monto, emite el retiro final.
 *
 * Va en transacción porque toca dos tablas: si el retiro se registrara y el cierre
 * fallara, quedaría un ingreso cargado sobre un turno que sigue abierto.
 */
export async function cerrarTurno(datos: DatosCierreTurno) {
  return prisma.$transaction(async (tx) => {
    const turno = await tx.turno.findUnique({ where: { id: datos.turnoId } });

    if (!turno) {
      throw errorDominio("TURNO_NO_ENCONTRADO", `No existe el turno ${datos.turnoId}.`);
    }

    if (turno.estado === "cerrado") {
      throw errorDominio(
        "TURNO_CERRADO",
        `El turno ${turno.nombre} del ${formatearFecha(turno.fecha)} ya estaba cerrado.`,
      );
    }

    // Un monto negativo es un error de carga, no un "no retirar". Si se ignorara
    // en silencio, el turno cerraría sin registrar el depósito y la diferencia
    // no aparecería en ningún lado.
    if (datos.montoRetiro && datos.montoRetiro.isNegative()) {
      throw errorDominio(
        "MONTO_INVALIDO",
        `El retiro de cierre no puede ser negativo (se recibió ${formatearMonto(datos.montoRetiro)}). ` +
          "Para cerrar sin retiro, no envíes monto.",
      );
    }

    if (datos.montoRetiro && datos.montoRetiro.greaterThan(0)) {
      await registrarRetiro(tx, {
        turnoId: turno.id,
        monto: datos.montoRetiro,
        observacion: datos.observacionRetiro ?? "Retiro de cierre de turno",
        usuarioId: datos.usuarioId,
      });
    }

    return tx.turno.update({
      where: { id: turno.id },
      data: { estado: "cerrado", fechaCierre: datos.fechaCierre ?? new Date() },
    });
  });
}
