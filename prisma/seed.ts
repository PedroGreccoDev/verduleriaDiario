import "dotenv/config";
import { dec } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import { sembrarCategoriasSistema } from "@/domain/caja/categorias";
import { abrirTurno, cerrarTurno } from "@/domain/caja/turno.service";
import { registrarRetiroParcial } from "@/domain/caja/retiro.service";
import { registrarMovimientoCaja } from "@/domain/caja/movimiento.service";
import { comprarCheque } from "@/domain/cheques/compra.service";
import { entregarCheque } from "@/domain/cheques/entrega.service";
import { rechazarCheque } from "@/domain/cheques/rechazo.service";
import { crearFacturaProveedor } from "@/domain/proveedores/factura.service";
import { pagarProveedorEnEfectivo } from "@/domain/proveedores/pago.service";
import {
  registrarCargoCliente,
  registrarPagoCliente,
} from "@/domain/clientes/cuenta-corriente.service";

/**
 * Datos de prueba para desarrollo.
 *
 * Todo pasa por los servicios de dominio en vez de insertarse directo. Es más
 * lento, pero garantiza que los saldos, las imputaciones y los movimientos de caja
 * queden consistentes entre sí — un seed que inserta a mano termina generando
 * estados que el sistema real nunca produciría, y después se depuran bugs que no
 * existen.
 *
 * Fechas fijas (agosto 2026) para que el seed sea reproducible.
 */

const TABLAS = [
  "imputacion_cheque",
  "imputacion_pago",
  "pago_proveedor",
  "movimiento_caja",
  "movimiento_cuenta_corriente",
  "cheque",
  "factura_proveedor",
  "proveedor",
  "vendedor_cheque",
  "cliente",
  "turno",
  "categoria_movimiento",
] as const;

/**
 * Guardarraíl: este seed BORRA todo antes de sembrar. Contra una base remota eso
 * sería catastrófico, así que solo corre contra localhost salvo que se fuerce
 * explícitamente con SEED_FORZAR=1.
 */
function verificarBaseSegura(): void {
  const url = process.env.DATABASE_URL ?? "";
  const esLocal = url.includes("localhost") || url.includes("127.0.0.1");

  if (!esLocal && process.env.SEED_FORZAR !== "1") {
    throw new Error(
      "El seed borra todos los datos y DATABASE_URL no apunta a localhost.\n" +
        "Si de verdad querés sembrar esta base, corré con SEED_FORZAR=1.",
    );
  }
}

async function limpiar() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLAS.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}

function fecha(dia: number, hora = 9): Date {
  return new Date(2026, 7, dia, hora, 0, 0);
}

async function main() {
  verificarBaseSegura();

  console.log("Limpiando…");
  await limpiar();

  console.log("Categorías de movimiento…");
  await sembrarCategoriasSistema(prisma);

  // --- Proveedores -----------------------------------------------------------
  console.log("Proveedores y facturas…");

  const mercadoCentral = await prisma.proveedor.create({
    data: { nombre: "Mercado Central — Puesto 45", contacto: "11 4455-2211" },
  });
  const frutasNorte = await prisma.proveedor.create({
    data: { nombre: "Frutas del Norte SRL", contacto: "Hugo — 11 6677-8899" },
  });
  const verdurasLaPlata = await prisma.proveedor.create({
    data: { nombre: "Verduras La Plata", contacto: "221 415-9080" },
  });
  const lacteosSanJose = await prisma.proveedor.create({
    data: { nombre: "Lácteos San José", contacto: "sanjose@lacteos.com.ar" },
  });

  // Facturas en distintos estados. Las de fecha más vieja quedan pendientes a
  // propósito, para que el reporte de vencimientos tenga algo que mostrar.
  const facMC1 = (
    await crearFacturaProveedor({
      proveedorId: mercadoCentral.id,
      numero: "0001-00014521",
      montoTotal: dec("485000"),
      fecha: fecha(3),
      fechaVencimiento: fecha(18),
    })
  ).factura;

  const facMC2 = (
    await crearFacturaProveedor({
      proveedorId: mercadoCentral.id,
      numero: "0001-00014733",
      montoTotal: dec("312500"),
      fecha: fecha(7),
      fechaVencimiento: fecha(22),
    })
  ).factura;

  const facFN1 = (
    await crearFacturaProveedor({
      proveedorId: frutasNorte.id,
      numero: "A-0003-00000891",
      montoTotal: dec("740000"),
      fecha: fecha(4),
      fechaVencimiento: fecha(19),
    })
  ).factura;

  const facFN2 = (
    await crearFacturaProveedor({
      proveedorId: frutasNorte.id,
      numero: "A-0003-00000934",
      montoTotal: dec("198000"),
      fecha: fecha(10),
      fechaVencimiento: fecha(25),
    })
  ).factura;

  const facVLP1 = (
    await crearFacturaProveedor({
      proveedorId: verdurasLaPlata.id,
      numero: "0002-00007712",
      montoTotal: dec("156000"),
      fecha: fecha(5),
      fechaVencimiento: fecha(20),
    })
  ).factura;

  await crearFacturaProveedor({
    proveedorId: lacteosSanJose.id,
    numero: "B-0001-00003345",
    montoTotal: dec("92300"),
    fecha: fecha(9),
    fechaVencimiento: fecha(24),
  });

  // --- Vendedores de cheques -------------------------------------------------
  console.log("Vendedores de cheques…");

  const financieraBelgrano = await prisma.vendedorCheque.create({
    data: { nombre: "Financiera Belgrano", contacto: "Daniel — 11 5544-1122" },
  });
  const chequesDelSur = await prisma.vendedorCheque.create({
    data: { nombre: "Cheques del Sur", contacto: "11 3322-7788" },
  });

  // --- Turnos, retiros y cheques ---------------------------------------------
  console.log("Turnos, movimientos de caja y cheques…");

  // Semana 1: turnos completos con retiros.
  for (const dia of [3, 4, 5, 6, 7]) {
    const mañana = await abrirTurno({ nombre: "mañana", fecha: fecha(dia) });
    await registrarRetiroParcial({
      turnoId: mañana.id,
      monto: dec(String(180000 + dia * 4500)),
      fecha: fecha(dia, 13),
    });
    await cerrarTurno({ turnoId: mañana.id, fechaCierre: fecha(dia, 14) });

    const tarde = await abrirTurno({ nombre: "tarde", fecha: fecha(dia, 14) });
    await cerrarTurno({
      turnoId: tarde.id,
      montoRetiro: dec(String(210000 + dia * 3800)),
      fechaCierre: fecha(dia, 21),
    });
  }

  // Semana 2, día 10: turno mañana con TRES retiros parciales por seguridad.
  const turno10 = await abrirTurno({ nombre: "mañana", fecha: fecha(10) });
  await registrarRetiroParcial({
    turnoId: turno10.id,
    monto: dec("95000"),
    fecha: fecha(10, 10),
    observacion: "Retiro parcial por seguridad",
  });
  await registrarRetiroParcial({
    turnoId: turno10.id,
    monto: dec("87500"),
    fecha: fecha(10, 12),
    observacion: "Retiro parcial por seguridad",
  });
  await cerrarTurno({
    turnoId: turno10.id,
    montoRetiro: dec("64200"),
    fechaCierre: fecha(10, 14),
  });

  const turno10Tarde = await abrirTurno({ nombre: "tarde", fecha: fecha(10, 14) });

  // Compra de cheques. Nominal + porcentaje: el sistema calcula lo pagado.
  const compras = [
    { numero: "00034521", banco: "Nación", librador: "Distribuidora El Sol SRL", nominal: "1200000", pct: "11.5", venc: 26, vendedor: financieraBelgrano.id },
    { numero: "00034522", banco: "Nación", librador: "Distribuidora El Sol SRL", nominal: "850000", pct: "10", venc: 30, vendedor: financieraBelgrano.id },
    { numero: "10077341", banco: "Galicia", librador: "Alimentos Pampa SA", nominal: "640000", pct: "8.75", venc: 28, vendedor: chequesDelSur.id },
    { numero: "10077398", banco: "Galicia", librador: "Alimentos Pampa SA", nominal: "415000", pct: "12", venc: 31, vendedor: chequesDelSur.id },
    { numero: "45001122", banco: "Provincia", librador: "Transporte Rivadavia SRL", nominal: "980000", pct: "9.25", venc: 27, vendedor: financieraBelgrano.id },
    { numero: "45001190", banco: "Provincia", librador: "Comercial Lomas SA", nominal: "270000", pct: "7", venc: 29, vendedor: chequesDelSur.id },
    { numero: "88220034", banco: "Santander", librador: "Mayorista Quilmes SRL", nominal: "1500000", pct: "13.5", venc: 30, vendedor: financieraBelgrano.id },
    { numero: "88220071", banco: "Santander", librador: "Mayorista Quilmes SRL", nominal: "325000", pct: "6.5", venc: 31, vendedor: chequesDelSur.id },
  ];

  const cheques = [];
  for (const [i, compra] of compras.entries()) {
    const { cheque } = await comprarCheque({
      numero: compra.numero,
      banco: compra.banco,
      librador: compra.librador,
      nominal: dec(compra.nominal),
      porcentajeDescuento: dec(compra.pct),
      fechaVencimiento: fecha(compra.venc),
      vendedorChequeId: compra.vendedor,
      fechaCompra: fecha(10 + Math.floor(i / 3), 15),
      turnoId: turno10Tarde.id,
    });
    cheques.push(cheque);
  }

  await cerrarTurno({ turnoId: turno10Tarde.id, fechaCierre: fecha(10, 21) });

  // --- Entregas de cheques ---------------------------------------------------
  console.log("Entregas de cheques…");

  // Un cheque que cubre DOS facturas del mismo proveedor.
  await entregarCheque({
    chequeId: cheques[0].id, // nominal 1.200.000
    proveedorId: mercadoCentral.id,
    imputaciones: [
      { facturaProveedorId: facMC1.id, monto: dec("485000") },
      { facturaProveedorId: facMC2.id, monto: dec("312500") },
    ],
    fechaEntrega: fecha(11, 10),
  });
  // Imputado 797.500 sobre nominal 1.200.000 → quedan 402.500 a favor.

  // Un cheque que cubre parcialmente una factura grande.
  await entregarCheque({
    chequeId: cheques[2].id, // nominal 640.000
    proveedorId: frutasNorte.id,
    imputaciones: [{ facturaProveedorId: facFN1.id, monto: dec("640000") }],
    fechaEntrega: fecha(11, 11),
  });

  // Un cheque que después va a rebotar.
  await entregarCheque({
    chequeId: cheques[5].id, // nominal 270.000
    proveedorId: verdurasLaPlata.id,
    imputaciones: [{ facturaProveedorId: facVLP1.id, monto: dec("156000") }],
    fechaEntrega: fecha(12, 10),
  });

  console.log("Rechazo de cheque…");
  await rechazarCheque({
    chequeId: cheques[5].id,
    motivo: "Rechazado por falta de fondos. Avisado el vendedor, queda a levantarlo.",
    fechaRechazo: fecha(14, 11),
  });

  // --- Pago en efectivo ------------------------------------------------------
  console.log("Pago a proveedor en efectivo…");

  const turno12 = await abrirTurno({ nombre: "mañana", fecha: fecha(12) });
  await pagarProveedorEnEfectivo({
    proveedorId: frutasNorte.id,
    monto: dec("198000"),
    imputaciones: [{ facturaProveedorId: facFN2.id, monto: dec("198000") }],
    fecha: fecha(12, 11),
    turnoId: turno12.id,
    observacion: "Pago en efectivo contra entrega",
  });

  // Gastos operativos varios.
  await prisma.$transaction(async (tx) => {
    await registrarMovimientoCaja(tx, {
      categoriaSlug: "gasto_operativo",
      monto: dec("34500"),
      referenciaTipo: "gasto",
      turnoId: turno12.id,
      fecha: fecha(12, 12),
      observacion: "Combustible y peajes",
    });
    await registrarMovimientoCaja(tx, {
      categoriaSlug: "gasto_operativo",
      monto: dec("18200"),
      referenciaTipo: "gasto",
      turnoId: turno12.id,
      fecha: fecha(12, 12),
      observacion: "Bolsas y cajones",
    });
    await registrarMovimientoCaja(tx, {
      categoriaSlug: "retiro_socio",
      monto: dec("150000"),
      referenciaTipo: "retiro_socio",
      turnoId: turno12.id,
      fecha: fecha(12, 13),
      observacion: "Retiro quincenal",
    });
  });

  await cerrarTurno({
    turnoId: turno12.id,
    montoRetiro: dec("225000"),
    fechaCierre: fecha(12, 14),
  });

  // --- Clientes (cuenta corriente / fiado) -----------------------------------
  console.log("Clientes y cuenta corriente…");

  const clientes = [
    { nombre: "Rotisería Doña Marta", telefono: "11 4422-9911" },
    { nombre: "Restaurante La Esquina", telefono: "11 4788-3322" },
    { nombre: "Comedor Escolar N° 12", telefono: "11 4900-1234" },
    { nombre: "Rosa Giménez", telefono: "11 6055-4488" },
    { nombre: "Carlos Pereyra", telefono: "11 3344-7788" },
    { nombre: "Pizzería Nápoli", telefono: "11 4123-5566" },
    { nombre: "Silvia Ledesma", telefono: null },
    { nombre: "Bar El Progreso", telefono: "11 4566-2200" },
    { nombre: "Marta Ríos", telefono: "11 6788-1100" },
    { nombre: "Kiosco Los Pinos", telefono: "11 4011-9922" },
  ];

  const turno13 = await abrirTurno({ nombre: "mañana", fecha: fecha(13) });

  for (const [i, datos] of clientes.entries()) {
    const cliente = await prisma.cliente.create({
      data: {
        nombre: datos.nombre,
        telefono: datos.telefono,
      },
    });

    // Cargos de fiado escalonados: los primeros deben más.
    await registrarCargoCliente({
      clienteId: cliente.id,
      monto: dec(String(18000 + i * 7500)),
      fecha: fecha(6 + (i % 4), 11),
      observacion: "Pedido semanal",
    });

    if (i % 3 === 0) {
      await registrarCargoCliente({
        clienteId: cliente.id,
        monto: dec(String(12000 + i * 3200)),
        fecha: fecha(9 + (i % 3), 11),
      });
    }

    // Algunos pagan parte de lo que deben: eso SÍ entra a la Bolsa Grande.
    if (i % 2 === 0) {
      await registrarPagoCliente({
        clienteId: cliente.id,
        monto: dec(String(10000 + i * 2500)),
        fecha: fecha(13, 12),
        turnoId: turno13.id,
      });
    }
  }

  await cerrarTurno({
    turnoId: turno13.id,
    montoRetiro: dec("198400"),
    fechaCierre: fecha(13, 14),
  });

  await resumen();
}

async function resumen() {
  const [cartera, entregados, proveedores, clientes, movimientos] = await Promise.all([
    prisma.cheque.aggregate({ where: { estado: "en_cartera" }, _sum: { nominal: true }, _count: true }),
    prisma.cheque.aggregate({ where: { fechaEntrega: { not: null } }, _sum: { ahorro: true }, _count: true }),
    prisma.proveedor.findMany({ select: { nombre: true, saldo: true } }),
    prisma.cliente.aggregate({ _sum: { saldo: true }, _count: true }),
    prisma.movimientoCaja.groupBy({ by: ["tipo"], _sum: { monto: true } }),
  ]);

  const ingresos = movimientos.find((m) => m.tipo === "ingreso")?._sum.monto ?? dec(0);
  const egresos = movimientos.find((m) => m.tipo === "egreso")?._sum.monto ?? dec(0);

  console.log("\n─── Resumen ───────────────────────────────────");
  console.log("Bolsa Grande (§5.1, solo efectivo)");
  console.log(`  Ingresos:  ${ingresos.toFixed(0)}`);
  console.log(`  Egresos:   ${egresos.toFixed(0)}`);
  console.log(`  Neto:      ${ingresos.minus(egresos).toFixed(0)}`);
  console.log("\nCartera de cheques (§5.2, a nominal — NO se suma a la Bolsa Grande)");
  console.log(`  ${cartera._count} cheques por ${(cartera._sum.nominal ?? dec(0)).toFixed(0)}`);
  console.log("\nAhorro realizado (no es un ingreso)");
  console.log(`  ${entregados._count} entregados, ahorro ${(entregados._sum.ahorro ?? dec(0)).toFixed(0)}`);
  console.log("\nSaldos de proveedores (negativo = saldo a favor)");
  for (const p of proveedores) {
    console.log(`  ${p.nombre.padEnd(32)} ${p.saldo.toFixed(0)}`);
  }
  console.log(`\nClientes: ${clientes._count}, deuda total ${(clientes._sum.saldo ?? dec(0)).toFixed(0)}`);
  console.log("───────────────────────────────────────────────\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
