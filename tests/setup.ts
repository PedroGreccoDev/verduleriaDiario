import { config } from "dotenv";
import { beforeAll, afterAll, beforeEach } from "vitest";

config();

const urlTest = process.env.DATABASE_URL_TEST;

if (!urlTest) {
  throw new Error(
    "Falta DATABASE_URL_TEST en .env. Ver .env.example.\n" +
      "Si el Postgres local está parado: npx prisma dev start -n verduleria-test",
  );
}

// Guardarraíl: la suite trunca todas las tablas antes de cada test. Si esto apunta
// a la base de desarrollo, se pierde el trabajo. Tiene que ir ANTES del redireccionamiento.
if (urlTest === process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL_TEST apunta a la misma base que DATABASE_URL. La suite trunca " +
      "todas las tablas: usá dos servidores de `prisma dev` distintos.",
  );
}

// Los servicios de dominio usan el cliente global de @/lib/prisma, que lee
// DATABASE_URL. Redirigirla acá es lo que hace que el dominio escriba en la base
// de test y no en la de desarrollo. Funciona porque ese cliente se construye de
// forma perezosa, en el primer uso, que siempre es posterior a esta línea.
process.env.DATABASE_URL = urlTest;

// El import va DESPUÉS del redireccionamiento a propósito.
const { prisma } = await import("@/lib/prisma");

export { prisma };

/** TRUNCATE ... CASCADE resuelve las FKs, así que el orden no importa. */
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
  // Usuarios al final: movimiento_caja, movimiento_cuenta_corriente y turno les
  // apuntan con onDelete: Restrict. TRUNCATE ... CASCADE lo resuelve igual, pero
  // el orden deja claro qué depende de qué.
  "sesion_usuario",
  "permiso_usuario",
  "usuario",
] as const;

export async function limpiarBase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLAS.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await limpiarBase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
