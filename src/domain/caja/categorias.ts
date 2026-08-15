import type { PrismaTx } from "@/lib/prisma";
import { errorDominio } from "@/lib/errores";

/**
 * Categorías que el sistema necesita para operar (§3.1).
 *
 * Son una tabla y no un enum porque el dueño va a querer agregar categorías sin
 * tocar el código. Pero estas siete tienen que existir sí o sí: los flujos de §4
 * las buscan por `slug`. Por eso el dominio nunca las busca por nombre — renombrar
 * "Gasto operativo" desde una pantalla de configuración no puede romper nada.
 */
export const CATEGORIAS_SISTEMA = [
  { slug: "retiro_turno", nombre: "Retiro de turno", tipo: "ingreso", orden: 10 },
  { slug: "cobro_cuenta_corriente", nombre: "Cobro cuenta corriente", tipo: "ingreso", orden: 20 },
  { slug: "aporte_socio", nombre: "Aporte de socio", tipo: "ingreso", orden: 30 },
  { slug: "compra_cheques", nombre: "Compra de cheques", tipo: "egreso", orden: 40 },
  { slug: "pago_proveedor_efectivo", nombre: "Pago a proveedor en efectivo", tipo: "egreso", orden: 50 },
  { slug: "gasto_operativo", nombre: "Gasto operativo", tipo: "egreso", orden: 60 },
  { slug: "retiro_socio", nombre: "Retiro de socio", tipo: "egreso", orden: 70 },
] as const;

export type SlugCategoria = (typeof CATEGORIAS_SISTEMA)[number]["slug"];

/**
 * Categorías que SIEMPRE las escribe un flujo de §4, nunca el operador a mano.
 *
 * Cada una de estas viene con algo más que el movimiento de caja: el retiro cierra
 * un turno, la compra de cheques suma nominal a la cartera, el pago a proveedor
 * imputa facturas y el cobro baja la deuda de un cliente. Cargarlas sueltas
 * anotaría la plata sin el hecho que la explica —un cobro que no le baja la deuda
 * a nadie, un pago que no salda ninguna factura— y la caja dejaría de coincidir
 * con las cuentas.
 *
 * Las otras tres del sistema (aporte y retiro de socio, gasto operativo) no tienen
 * flujo propio: existen justamente para cargarse a mano. Las que agregue el dueño
 * más adelante también, porque nada las genera automáticamente.
 */
export const SLUGS_DE_FLUJO: readonly string[] = [
  "retiro_turno",
  "cobro_cuenta_corriente",
  "compra_cheques",
  "pago_proveedor_efectivo",
];

export function esCategoriaDeFlujo(slug: string): boolean {
  return SLUGS_DE_FLUJO.includes(slug);
}

/** Idempotente: se puede correr en cada seed y en cada arranque sin duplicar. */
export async function sembrarCategoriasSistema(tx: PrismaTx): Promise<void> {
  for (const categoria of CATEGORIAS_SISTEMA) {
    await tx.categoriaMovimiento.upsert({
      where: { slug: categoria.slug },
      update: {},
      create: {
        slug: categoria.slug,
        nombre: categoria.nombre,
        tipo: categoria.tipo,
        orden: categoria.orden,
      },
    });
  }
}

export async function obtenerCategoriaPorSlug(tx: PrismaTx, slug: SlugCategoria) {
  const categoria = await tx.categoriaMovimiento.findUnique({ where: { slug } });

  if (!categoria) {
    throw errorDominio(
      "CATEGORIA_NO_ENCONTRADA",
      `No existe la categoría de sistema "${slug}". Corré el seed de categorías.`,
    );
  }

  return categoria;
}

/**
 * Por id, para lo que carga el operador: las categorías que él agregue no tienen
 * un slug que el código pueda conocer de antemano.
 */
export async function obtenerCategoriaPorId(tx: PrismaTx, id: string) {
  const categoria = await tx.categoriaMovimiento.findUnique({ where: { id } });

  if (!categoria) {
    throw errorDominio("CATEGORIA_NO_ENCONTRADA", "Esa categoría no existe.");
  }

  return categoria;
}

/**
 * Las que el operador puede elegir al cargar un movimiento a mano: las activas
 * que no las escribe ningún flujo.
 */
export async function categoriasCargables(tx: PrismaTx) {
  const categorias = await tx.categoriaMovimiento.findMany({
    where: { activo: true },
    orderBy: [{ tipo: "asc" }, { orden: "asc" }, { nombre: "asc" }],
  });

  return categorias.filter((categoria) => !esCategoriaDeFlujo(categoria.slug));
}
